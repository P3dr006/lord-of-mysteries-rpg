#!/usr/bin/env python3
"""Gera js/sigilos-data.js (sigilos embutidos em base64) a partir de img/sigilos/*.webp.

O arquivo só é carregado ao gerar o pôster. Ele existe porque o navegador bloqueia
ler imagens de arquivos locais (file://) dentro de um canvas. Uso, na raiz do projeto:
    python3 tools/gerar-sigilos-data.py
Requer Pillow (pip install pillow).
"""
import base64, glob, io, json, os
from PIL import Image

saida = {}
for f in sorted(glob.glob('img/sigilos/*.webp')):
    id = os.path.basename(f)[:-5]
    im = Image.open(f).convert('RGBA').resize((176, 176), Image.LANCZOS)
    q = im.quantize(colors=96, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    b = io.BytesIO(); q.save(b, 'PNG', optimize=True)
    saida[id] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
open('js/sigilos-data.js', 'w').write(
    '// Sigilos embutidos (176 px) para o pôster: evita bloqueio de canvas em arquivos locais.\n'
    'const SIGILOS_DATA = ' + json.dumps(saida) + ';\n')
print(len(saida), 'sigilos,', round(os.path.getsize('js/sigilos-data.js') / 1024), 'KB')
