import numpy as np, scipy.io.wavfile as w, scipy.signal as sg, sys, json
def analyze(path, min_sil=0.12, thr_db=-38):
    sr,a=w.read(path); a=a.astype(float)/32768
    b,aa=sg.butter(4,[300/(sr/2),3000/(sr/2)],'band'); x=sg.filtfilt(b,aa,a)
    hop=int(0.01*sr); win=int(0.03*sr)
    env=np.array([np.sqrt(np.mean(x[i:i+win]**2)) for i in range(0,len(x)-win,hop)])
    db=20*np.log10(env+1e-9)
    # speech mask
    sp=db>thr_db
    # segments with min silence
    segs=[]; i=0; n=len(sp)
    while i<n:
        if sp[i]:
            j=i
            while j<n:
                if not sp[j]:
                    k=j
                    while k<n and not sp[k]: k+=1
                    if k-j>=min_sil/0.01 or k==n: break
                    j=k
                else: j+=1
            segs.append((i*0.01,j*0.01)); i=j
        else: i+=1
    segs=[(s,e) for s,e in segs if e-s>0.08]
    # syllable nuclei: peaks of smoothed envelope
    sm=sg.savgol_filter(env,7,2)
    pk,_=sg.find_peaks(sm,prominence=np.max(sm)*0.06,distance=9)
    pk=[p*0.01+0.015 for p in pk if db[p]>thr_db+4]
    return segs,pk,db
if __name__=='__main__':
    segs,pk,db=analyze(sys.argv[1], float(sys.argv[2]) if len(sys.argv)>2 else 0.12)
    for s,e in segs:
        n=sum(1 for p in pk if s<=p<=e)
        print(f"{s:6.2f}-{e:6.2f} ({e-s:4.2f}s) syl~{n}")
