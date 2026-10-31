import json, subprocess
TL=json.load(open('timeline.json'))
src={'hook':'src/hook.mov','main':'src/main.mov','cta':'src/cta.mp4'}
# zoom per clip tag: (z_start, z_end, anchor_x 0..1, anchor_y 0..1)
Z={'hook':(1.0,1.07,0.5,0.4),'I':(1.22,1.16,1.0,0.25),'V':(1.06,1.12,1.0,0.3),'AF':(1.3,1.2,1.0,0.25),'cta':(1.04,1.0,0.5,0.4)}
args=['ffmpeg','-v','error','-y']; fc=[]
for i,c in enumerate(TL['clips']):
    args+=['-ss',f"{c['in']:.4f}",'-t',f"{c['out']-c['in']+0.2:.4f}",'-i',src[c['src']]]
    d=c['out']-c['in']; z0,z1,ax,ay=Z.get(c['tag'],(1.0,1.0,1.0,0.3))
    zexpr=f"({z0}+({z1}-{z0})*min(t/{d:.3f},1))"
    fc.append(f"[{i}:v]scale=1080:1920:flags=lanczos,setsar=1,fps=30,scale=w='trunc(1080*{zexpr}/2)*2':h=-2:eval=frame:flags=bicubic,crop=1080:1920:x='(iw-1080)*{ax}':y='(ih-1920)*{ay}',eq=contrast=1.04:saturation=1.08,unsharp=5:5:0.4,setsar=1,format=yuv420p,trim=end_frame={round(c['t1']*30)-round(c['t0']*30)},setpts=PTS-STARTPTS[v{i}]")
n=len(TL['clips'])
fc.append(''.join(f'[v{i}]' for i in range(n))+f'concat=n={n}:v=1:a=0[out]')
args+=['-filter_complex',';'.join(fc),'-map','[out]','-c:v','libx264','-preset','veryfast','-crf','14','-pix_fmt','yuv420p','base.mp4']
subprocess.run(args,check=True)
print(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration:stream=nb_frames,width,height','-of','compact','base.mp4'],capture_output=True,text=True).stdout)
