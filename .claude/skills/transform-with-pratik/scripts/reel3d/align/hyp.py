import numpy as np, scipy.io.wavfile as wv, struct, subprocess, sys
from align import tts_word, mfcc, SR
sr,a=wv.read('../audio/main.wav'); a=a.astype(float)/32768
def cost(text, t0, t1):
    seg=a[int(t0*sr):int(t1*sr)]
    T=np.concatenate([np.concatenate([tts_word(w), np.zeros(480)]) for w in text.split()])
    FA,ea=mfcc(seg); FB,eb=mfcc(T)
    A=FA[ea>np.percentile(ea,95)-7.5].astype(np.float32); B=FB[eb>np.percentile(eb,95)-9].astype(np.float32)
    with open('h.bin','wb') as f: f.write(struct.pack('iii',len(A),len(B),A.shape[1])); f.write(A.tobytes()); f.write(B.tobytes())
    subprocess.run(['./dtw','h.bin','h.txt'],check=True)
    p=np.loadtxt('h.txt',dtype=int)
    An=A/np.linalg.norm(A,axis=1,keepdims=True); Bn=B/np.linalg.norm(B,axis=1,keepdims=True)
    c=1-np.sum(An[p[:,0]]*Bn[p[:,1]],1)
    return c.mean(), len(A), len(B)
