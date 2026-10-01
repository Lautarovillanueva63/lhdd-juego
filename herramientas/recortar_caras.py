# Saca el fondo de las fotos y deja SOLO la forma de la cara (pelo + cara, sin círculo).
#
# Cómo funciona: usa un modelo de "face parsing" (BiSeNet) que mira la foto y
# le pone una etiqueta a cada píxel: piel, ojos, nariz, boca, pelo, gorra, ropa, fondo...
# Nos quedamos con los píxeles que son cara/pelo/gorra y el resto lo hacemos transparente.
#
# Uso (desde esta carpeta):
#   pip install onnxruntime numpy scipy pillow
#   python recortar_caras.py
# La primera vez descarga el modelo (~90 MB) de GitHub.
# Las fotos originales tienen que estar en assets/caras_originales/<id>.png
import os, urllib.request
import numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
from scipy import ndimage as nd

MODELO = 'resnet34.onnx'
if not os.path.exists(MODELO):
    urllib.request.urlretrieve('https://github.com/yakhyo/face-parsing/releases/download/v0.0.1/resnet34.onnx', MODELO)
sess = ort.InferenceSession(MODELO)

# Etiquetas del modelo: 1 piel, 2-3 cejas, 4-5 ojos, 6 anteojos, 7-9 orejas, 10 nariz,
# 11-13 boca/labios, 14 cuello, 16 ropa, 17 pelo, 18 gorra. (0 es el fondo)
CARA = [1,2,3,4,5,6,7,8,9,10,11,12,13,17]
EXTRA = {'bass': [18]}   # Chanchi tiene gorra: la sumamos solo para él

MEAN = np.array([0.485, 0.456, 0.406]); STD = np.array([0.229, 0.224, 0.225])
for n in ['bass', 'gtr1', 'gtr2', 'keys', 'voz']:
    foto = Image.open(f'../assets/caras_originales/{n}.png').convert('RGBA')
    gris = Image.new('RGBA', foto.size, (128,128,128,255)); gris.alpha_composite(foto)
    x = np.asarray(gris.convert('RGB').resize((512,512), Image.BICUBIC), np.float32) / 255
    x = ((x - MEAN) / STD).transpose(2,0,1)[None].astype(np.float32)
    etiquetas = sess.run(None, {'input': x})[0][0].argmax(0)          # 512x512 con un número por píxel

    m = np.isin(etiquetas, CARA + EXTRA.get(n, []))                  # True donde hay cara
    m = nd.binary_opening(m, iterations=3)                            # borra puntitos sueltos
    lab, k = nd.label(m)                                              # nos quedamos con la mancha más grande
    if k > 1: m = lab == 1 + np.argmax(nd.sum(m, lab, range(1, k+1)))
    m = nd.binary_fill_holes(nd.binary_closing(m, iterations=6))      # tapa agujeros (ojos, boca)
    borde = Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.5))  # borde suave

    grande = foto.resize((512,512), Image.LANCZOS)
    grande.putalpha(Image.fromarray(np.minimum(np.asarray(borde), np.asarray(grande.split()[3]))))
    recorte = grande.crop(grande.getbbox())
    lado = max(recorte.size); cuadrado = Image.new('RGBA', (lado, lado))
    cuadrado.alpha_composite(recorte, ((lado-recorte.size[0])//2, (lado-recorte.size[1])//2))
    cuadrado.resize((256,256), Image.LANCZOS).save(f'../assets/caras/{n}.png')
    print('listo', n)
