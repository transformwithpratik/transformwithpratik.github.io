import numpy as np, scipy.signal as sg, scipy.io.wavfile as wv, json
SR=44100; TL=json.load(open('timeline.json')); DUR=TL['total']+0.6
N=int(DUR*SR); rng=np.random.default_rng(3)
def env_exp(n, tau): return np.exp(-np.arange(n)/SR/tau)
def lp(x, f, o=2): b,a=sg.butter(o, f/(SR/2)); return sg.lfilter(b,a,x)
def hp(x, f, o=2): b,a=sg.butter(o, f/(SR/2), 'high'); return sg.lfilter(b,a,x)
def bp(x, f1, f2, o=2): b,a=sg.butter(o, [f1/(SR/2), f2/(SR/2)], 'band'); return sg.lfilter(b,a,x)
def add(buf, x, t, g=1.0):
    i=int(t*SR); 
    if i>=len(buf): return
    x=x[:len(buf)-i]; buf[i:i+len(x)]+=x*g
def saw(f, n, ph=0):
    t=np.arange(n)/SR; return 2*((f*t+ph)%1)-1
def note(m): return 440*2**((m-69)/12)
# --- instruments
def kick():
    n=int(0.45*SR); t=np.arange(n)/SR; f=45+120*np.exp(-t*32); ph=2*np.pi*np.cumsum(f)/SR
    x=np.sin(ph)*np.exp(-t*7.5); x[:int(0.004*SR)]+=rng.normal(0,0.6,int(0.004*SR))*np.linspace(1,0,int(0.004*SR))
    return np.tanh(x*1.6)
def clap():
    n=int(0.35*SR); x=np.zeros(n); nz=rng.normal(0,1,n)
    for k,o in enumerate([0,0.011,0.022]):
        i=int(o*SR); m=n-i; x[i:]+=nz[:m]*np.exp(-np.arange(m)/SR/ (0.012 if k<2 else 0.14))
    x=bp(x,900,5200); body=np.sin(2*np.pi*190*np.arange(n)/SR)*np.exp(-np.arange(n)/SR/0.05)*0.4
    return (x*0.9+body)
def hat(open_=False):
    n=int((0.25 if open_ else 0.06)*SR); x=hp(rng.normal(0,1,n),7500,4)*np.exp(-np.arange(n)/SR/(0.09 if open_ else 0.016)); return x*0.5
def pluck(f, dur=0.22):
    n=int(dur*SR); t=np.arange(n)/SR
    x=saw(f,n)+saw(f*1.004,n,0.3)+0.5*saw(f*2.002,n,0.6)
    e=np.exp(-t/0.09); x=lp(x*e, 3200)*np.minimum(1,t/0.002)
    return x*0.35
def pad_chord(fs, dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=np.zeros(n)
    for f in fs:
        for d in (-0.006,0,0.007): x+=saw(f*(1+d),n,rng.random())
    x=lp(x,1100,2); a=np.minimum(1,t/0.35)*np.minimum(1,(dur-t)/0.3+0.0); return x*a*0.08
def sub(f, dur):
    n=int(dur*SR); t=np.arange(n)/SR; x=np.sin(2*np.pi*f*t)+0.3*np.sin(4*np.pi*f*t)
    a=np.minimum(1,t/0.005)*np.minimum(1,(dur-t)/0.02); return np.tanh(x*1.5)*a*0.55
def riser(dur):
    n=int(dur*SR); t=np.arange(n)/SR; nz=rng.normal(0,1,n); out=np.zeros(n); blk=1024
    for i in range(0,n,blk):
        fc=300*(20**(i/n)); seg=nz[i:i+blk]; out[i:i+blk]=bp(np.concatenate([nz[max(0,i-2048):i],seg]),fc,min(fc*1.8,18000))[-len(seg):]
    tone=np.sin(2*np.pi*np.cumsum(200*(4**(t/dur)))/SR)*0.25
    return (out*0.6+tone)*(t/dur)**2
def impact():
    n=int(2.2*SR); t=np.arange(n)/SR; f=40+70*np.exp(-t*9); x=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*1.6)
    nz=lp(rng.normal(0,1,n),2500)*np.exp(-t*5)*0.5
    return np.tanh((x+nz)*1.8)*0.9
def reverb_ir(dur=1.6):
    n=int(dur*SR); t=np.arange(n)/SR; return np.stack([rng.normal(0,1,n)*np.exp(-t*3.2), rng.normal(0,1,n)*np.exp(-t*3.2)])*0.02
# --- arrangement
beat=0.5; off=TL['gfx'][0]['start']%2.0  # downbeat at meal start
drums=np.zeros(N); kick_bus=np.zeros(N); synth=np.zeros((2,N)); bass=np.zeros(N); fx=np.zeros(N)
O=TL['ov']; G={g['scene']:g for g in TL['gfx']}
sections=[ # (t0,t1,mode)
 (0.0, G['meal']['start'], 'intro'), (G['meal']['start'], G['curious']['start'], 'full'), (G['curious']['start'], G['walk']['start'], 'break'),
 (G['walk']['start'], O['why'][0], 'full'), (O['why'][0], G['muscle']['start'], 'stop'), (G['muscle']['start'], O['todo'][0], 'full'),
 (O['todo'][0], G['couch']['start'], 'half'), (G['couch']['start'], O['move'][0], 'full2'), (O['move'][0], DUR, 'full2')]
def mode_at(t):
    for a,b,m in sections:
        if a<=t<b: return m
    return 'full'
prog=[(57,[69,72,76],33),(53,[65,69,72],29),(48,[64,67,72],36),(55,[67,71,74],31)]  # (root midi for pad, arp notes, bass midi)
K=kick(); C=clap(); Hc=hat(); Ho=hat(True)
t=off-2.0
step=beat/4
nsteps=int((DUR-t)/step)+1
kick_times=[]
for s in range(nsteps):
    tt=t+s*step
    if tt<0 or tt>=DUR-0.3: continue
    m=mode_at(tt); bi=s%16; bar=int(np.floor((tt-off)/2.0)); ch=prog[bar%4]
    if m=='stop': continue
    if m in('full','full2'):
        if bi%4==0: add(kick_bus,K,tt,0.9); kick_times.append(tt)
        if bi in(4,12): add(drums,C,tt,0.55)
        add(drums,Hc,tt,0.22 if bi%2 else 0.32)
        if bi in(14,) : add(drums,Ho,tt,0.25)
        if m=='full2' and bi in(3,7,11,15): add(drums,Hc,tt,0.18)
        if bi%2==0: add(bass,sub(note(ch[2]),step*1.8),tt,1.0 if bi%4==0 else 0.75)
        arp=ch[1]; f=note(arp[[0,1,2,1][bi%4]]+(12 if bi>=8 else 0))
        pl=pluck(f); synth[0,int(tt*SR):int(tt*SR)+len(pl)]+=pl[:max(0,min(len(pl),N-int(tt*SR)))]*(0.9 if bi%2 else 0.6)
        synth[1,int(tt*SR):int(tt*SR)+len(pl)]+=pl[:max(0,min(len(pl),N-int(tt*SR)))]*(0.6 if bi%2 else 0.9)
    elif m=='intro':
        if bi in(0,8): add(kick_bus,lp(K,400),tt,0.7); kick_times.append(tt)
        if bi%2==0: add(drums,Hc,tt,0.12+0.1*(tt/G['meal']['start']))
        if bi==0: add(bass,sub(note(ch[2]),1.9),tt,0.6)
    elif m=='half':
        if bi==0: add(kick_bus,K,tt,0.8); kick_times.append(tt)
        if bi==8: add(drums,C,tt,0.4)
        if bi%4==2: add(drums,Hc,tt,0.15)
        if bi%4==0: add(bass,sub(note(ch[2]),step*3.5),tt,0.7)
    elif m=='break':
        if bi%4==0: add(drums,Hc,tt,0.1)
# pads per bar (all sections except stop), filtered in break/intro
for bar in range(-1,int(DUR/2)+2):
    tt=off+bar*2.0
    if tt+2<0 or tt>=DUR: continue
    ch=prog[bar%4]; p=pad_chord([note(x-12) for x in ch[1]],2.05)
    i0=int(max(0,tt)*SR); pp=p[int(max(0,-tt)*SR):]; L=min(len(pp),N-i0)
    synth[:,i0:i0+L]+=pp[:L]
# mute music in 'stop' section; lowpass in intro/break/half by envelope blending
def sec_mask(name, fade=0.03):
    m=np.zeros(N)
    for a,b,mm in sections:
        if mm==name: m[int(a*SR):int(b*SR)]=1
    k=int(fade*SR); return np.convolve(m,np.ones(k)/k,'same')
stop=sec_mask('stop',0.02)
# sidechain duck from kicks
sc=np.ones(N)
for kt in kick_times:
    i=int(kt*SR); n=int(0.3*SR); e=1-0.55*np.exp(-np.arange(n)/SR/0.07); seg=sc[i:i+n]; sc[i:i+n]=np.minimum(seg,e[:len(seg)])
ir=reverb_ir()
wet=np.stack([sg.fftconvolve(synth[0]+drums*0.3,ir[0])[:N], sg.fftconvolve(synth[1]+drums*0.3,ir[1])[:N]])
mus=np.stack([synth[0]*sc+bass*sc+drums+kick_bus+wet[0], synth[1]*sc+bass*sc+drums+kick_bus+wet[1]])
# filtered sections (intro/break/half): lowpass blend
lpmask=np.clip(sec_mask('intro',0.2)+sec_mask('break',0.05)+sec_mask('half',0.05),0,1)
mus_lp=np.stack([lp(mus[0],700),lp(mus[1],700)])
mus=mus*(1-lpmask)+mus_lp*lpmask*1.3
# risers into drops + impacts + stop
R1=riser(1.6); R2=riser(1.05); IMP=impact()
for tt,rr in ((G['meal']['start']-1.6,R1),(G['walk']['start']-1.05,R2),(G['muscle']['start']-0.45,riser(0.45)),(G['couch']['start']-1.1,riser(1.1)),(O['move'][0]-0.9,riser(0.9))):
    i=int(tt*SR); L=min(len(rr),N-i); mus[:,i:i+L]+=rr[:L]*0.35
for tt,g in ((0.0,0.8),(O['why'][0]+0.02,0.9),(O['move'][0]+0.05,1.0),(G['meal']['start'],0.55)):
    i=int(tt*SR); L=min(len(IMP),N-i); mus[:,i:i+L]+=IMP[:L]*g
mus=mus*(1-stop*0.92)
# ending: fade the last 0.8 s
fe=int((TL['total']-0.6)*SR); mus[:,fe:]*=np.linspace(1,0,N-fe)**1.5
mus=np.tanh(mus*0.9)
mus/=np.max(np.abs(mus))*1.12
wv.write('aud/music.wav',SR,(mus.T*32767).astype(np.int16))
print('music ok', DUR)
