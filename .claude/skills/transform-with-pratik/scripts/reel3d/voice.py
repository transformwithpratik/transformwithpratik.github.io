import json, subprocess
TL=json.load(open('timeline.json'))
gain={'hook':4.0,'main':0.0,'cta':-0.3}
inputs={'hook':0,'main':1,'cta':2}
parts=[];labels=[]
for i,c in enumerate(TL['clips']):
    d=c['out']-c['in']
    parts.append(f"[{inputs[c['src']]}:a]atrim={c['in']:.4f}:{c['out']:.4f},asetpts=PTS-STARTPTS,volume={gain[c['src']]}dB,afade=t=in:d=0.012,afade=t=out:st={d-0.015:.4f}:d=0.015[a{i}]")
    labels.append(f"[a{i}]")
fc=';'.join(parts)+';'+''.join(labels)+f"concat=n={len(labels)}:v=0:a=1[cat];[cat]highpass=f=85,afftdn=nr=10:nf=-45:tn=1,equalizer=f=250:t=q:w=1.2:g=-2.5,equalizer=f=3200:t=q:w=1.0:g=2.5,equalizer=f=9000:t=q:w=1.0:g=1.5,deesser=i=0.35,acompressor=threshold=-22dB:ratio=3:attack=8:release=120:makeup=2[out]"
subprocess.run(['ffmpeg','-v','error','-y','-i','aud/hook_48.wav','-i','aud/main_48.wav','-i','aud/cta_48.wav','-filter_complex',fc,'-map','[out]','-ar','48000','aud/voice_raw.wav'],check=True)
# loudnorm two-pass to -16
r=subprocess.run(['ffmpeg','-hide_banner','-i','aud/voice_raw.wav','-af','loudnorm=I=-16:TP=-2:LRA=9:print_format=json','-f','null','-'],capture_output=True,text=True).stderr
j=json.loads(r[r.rindex('{'):r.rindex('}')+1])
subprocess.run(['ffmpeg','-v','error','-y','-i','aud/voice_raw.wav','-af',f"loudnorm=I=-16:TP=-2:LRA=9:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true",'-ar','48000','aud/voice.wav'],check=True)
print(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0','aud/voice.wav'],capture_output=True,text=True).stdout, TL['total'])
