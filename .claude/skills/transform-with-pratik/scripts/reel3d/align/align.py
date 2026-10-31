import numpy as np, scipy.io.wavfile as wv, scipy.signal as sg, subprocess, json, sys, os, re, struct
SR=16000
def tts_word(w, voice='rms'):
    fn=f'tts/{re.sub(r"[^a-z0-9]","_",w.lower())}_{voice}.wav'
    if not os.path.exists(fn):
        os.makedirs('tts',exist_ok=True)
        txt=w.replace("'","").replace(':','\\:')
        subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f"flite=text='{txt}':voice={voice}",'-af','silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=1:stop_threshold=-45dB:stop_duration=0.05,aresample=16000','-ac','1',fn],check=True)
    sr,a=wv.read(fn); return a.astype(float)/32768
def mfcc(x, sr=SR, nmf=13):
    hop=int(0.01*sr); win=int(0.025*sr); nfft=512
    x=np.append(x[0],x[1:]-0.97*x[:-1])
    frames=np.lib.stride_tricks.sliding_window_view(np.pad(x,(0,win)),win)[::hop]*np.hamming(win)
    mag=np.abs(np.fft.rfft(frames,nfft))**2
    mel=lambda f:2595*np.log10(1+f/700); imel=lambda m:700*(10**(m/2595)-1)
    pts=imel(np.linspace(mel(80),mel(7600),28)); bins=np.floor((nfft+1)*pts/sr).astype(int)
    fb=np.zeros((26,nfft//2+1))
    for i in range(26):
        a,b,c=bins[i],bins[i+1],bins[i+2]
        fb[i,a:b]=(np.arange(a,b)-a)/max(1,b-a); fb[i,b:c]=(c-np.arange(b,c))/max(1,c-b)
    fe=np.log(mag@fb.T+1e-8)
    from scipy.fft import dct
    cc=dct(fe,type=2,axis=1,norm='ortho')[:,1:nmf]
    en=np.log(np.sum(mag,1)+1e-8)
    d=np.vstack([cc[:1]*0,np.diff(cc,axis=0)])
    f=np.hstack([cc,d*2])
    return (f-f.mean(0))/(f.std(0)+1e-6), en
def run(audio, words, out, t0=0, t1=None, voice='rms'):
    sr,a=wv.read(audio); a=a.astype(float)/32768
    if t1 is None: t1=len(a)/sr
    seg=a[int(t0*sr):int(t1*sr)]
    # TTS sequence with word boundaries (frames)
    tts=[]; bounds=[]; pos=0; gap=np.zeros(int(0.03*SR))
    for w in words:
        x=tts_word(w['w'], voice); s=pos; tts.append(x); pos+=len(x); bounds.append((s/SR,pos/SR)); tts.append(gap); pos+=len(gap)
    T=np.concatenate(tts)
    FA,ea=mfcc(seg); FB,eb=mfcc(T)
    # drop silent frames of real audio (keep map)
    thr=np.percentile(ea,95)-7.5
    keep=np.where(ea>thr)[0]
    # keep short gaps (<=8 frames) as speech
    mask=ea>thr
    i=0
    while i<len(mask):
        if not mask[i]:
            j=i
            while j<len(mask) and not mask[j]: j+=1
            if j-i<=8 and i>0 and j<len(mask): mask[i:j]=True
            i=j
        else: i+=1
    keep=np.where(mask)[0]
    tb=np.percentile(eb,95)-9; keepb=np.arange(len(eb))  # keep all TTS frames
    A=FA[keep].astype(np.float32); B=FB[keepb].astype(np.float32)
    with open('dtw_in.bin','wb') as f:
        f.write(struct.pack('iii',len(A),len(B),A.shape[1])); f.write(A.tobytes()); f.write(B.tobytes())
    subprocess.run(['./dtw','dtw_in.bin','dtw_path.txt'],check=True)
    path=np.loadtxt('dtw_path.txt',dtype=int)[::-1]
    # map tts frame -> first/last real frame
    b2a_first={}; b2a_last={}
    for ia,ib in path:
        b2a_first.setdefault(ib,ia); b2a_last[ib]=ia
    res=[]
    for w,(s,e) in zip(words,bounds):
        fs=int(s*100); fe=max(fs,int(e*100)-1)
        fs=min(fs,len(B)-1); fe=min(fe,len(B)-1)
        ra=b2a_first.get(fs); rb=b2a_last.get(fe)
        ts=t0+keep[ra]*0.01; te=t0+keep[rb]*0.01+0.01
        res.append({**w,'s':round(ts,3),'e':round(te,3)})
    json.dump(res,open(out,'w'),indent=0)
    return res
if __name__=='__main__':
    pass
