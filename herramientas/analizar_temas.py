# Analiza cada tema (tempo, beats y energía) y genera js/charts.js
# Uso: pip install numpy  |  necesita ffmpeg instalado  |  correr desde esta carpeta:
#   python analizar_temas.py
# Para sumar un tema nuevo: poné el mp3 en assets/temas, agregá su id en la lista de abajo
# y en SONGS dentro de js/game.js.
import numpy as np, subprocess, json
SR=11025; HOP=256
out={}
for n in ['botella','hoy','talvez','criticar','cuadra','lio']:
    raw=subprocess.run(['ffmpeg','-v','error','-i',f'../assets/temas/{n}.mp3','-ac','1','-ar',str(SR),'-f','s16le','-'],capture_output=True).stdout
    x=np.frombuffer(raw,np.int16).astype(np.float32)/32768
    N=1024; frames=(len(x)-N)//HOP
    idx=np.arange(N)[None,:]+HOP*np.arange(frames)[:,None]
    S=np.abs(np.fft.rfft(x[idx]*np.hanning(N),axis=1))
    S=np.log1p(10*S)
    flux=np.maximum(0,np.diff(S,axis=0)).sum(1); flux=np.concatenate([[0],flux])
    flux-=np.convolve(flux,np.ones(32)/32,'same'); flux=np.maximum(flux,0)
    fps=SR/HOP
    # tempo via autocorrelation 70-180 bpm
    ac=np.correlate(flux[:int(fps*90)],flux[:int(fps*90)],'full')[int(fps*90)-1:]
    lags=np.arange(len(ac)); bpm=60*fps/np.maximum(lags,1)
    mask=(bpm>=80)&(bpm<=170); L=lags[mask][np.argmax(ac[mask])]; period=L/fps
    # phase
    best=0;bp=0
    for ph in np.linspace(0,period,40,endpoint=False):
        t=np.arange(ph,len(flux)/fps,period); s=flux[np.minimum((t*fps).astype(int),len(flux)-1)].sum()
        if s>best: best=s;bp=ph
    beats=np.arange(bp,len(flux)/fps-1,period)
    rms=np.sqrt(np.convolve(x**2,np.ones(SR)/SR,'same'))[::SR//10]  # 10/s
    e=np.array([rms[min(int(b*10),len(rms)-1)] for b in beats]); e=(e-e.min())/(e.max()-e.min()+1e-9)
    st=np.array([flux[min(int(b*fps),len(flux)-1)] for b in beats]); st=st/ (np.percentile(st,95)+1e-9)
    out[n]={'bpm':round(60/period,1),'dur':round(len(x)/SR,2),'beats':[round(float(b),3) for b in beats],'e':[round(float(v),2) for v in e],'s':[round(float(min(v,1.5)),2) for v in st]}
    print(n,out[n]['bpm'],out[n]['dur'],len(beats))
open('../js/charts.js','w').write('// Generado por herramientas/analizar_temas.py — beats y energía de cada tema\nconst CHARTS = '+json.dumps(out,separators=(',',':'))+';\n')
