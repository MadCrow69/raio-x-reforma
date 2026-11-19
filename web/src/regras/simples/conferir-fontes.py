"""Confere anexos-2027.json, célula a célula, contra as duas fontes oficiais.

Uso:  python -I conferir-fontes.py [--json anexos-2027.json] [--lc214 lcp214.htm] [--res190 res190.htm]

Sem --lc214/--res190, baixa as páginas. O DOU (in.gov.br) costuma recusar download por script
(HTTP 403): nesse caso salve a página (navegador ou curl com User-Agent de navegador) e use --res190.

Lê (1) a LC 214/2025 no Planalto, descartando o texto tachado (redação revogada), e
(2) a Resolução CGSN nº 190/2026 no DOU; extrai de cada Anexo a tabela "Para os anos-calendário
2027 e 2028" e compara faixas, alíquota nominal, parcela a deduzir, repartição e teto de ISS.
Imprime OK/DIVERGE por anexo e fonte e sai com código 1 se houver divergência.
"""
import argparse
import json
import re
import sys
import urllib.request
from decimal import Decimal as D
from html.parser import HTMLParser
from pathlib import Path

URL_LC214 = 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm'
URL_RES190 = 'https://www.in.gov.br/web/dou/-/resolucao-cgsn-n-190-de-4-de-agosto-de-2026-724454118'
MARCAS_LC214 = {'I': 'ANEXO XVIII', 'II': 'ANEXO XIX', 'III': 'ANEXO XX ', 'IV': 'ANEXO XXI ', 'V': 'ANEXO XXII '}
COLUNAS = ('IRPJ', 'CSLL', 'CBS', 'CPP', 'IPI', 'ICMS', 'ISS', 'ISS (*)', 'IBS')
VAZIAS = {'br', 'img', 'hr', 'meta', 'link', 'input', 'col', 'area', 'base', 'wbr', 'param', 'source'}
NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'


def obter(url, arquivo):
    if arquivo:
        raw = Path(arquivo).read_bytes()
    else:
        req = urllib.request.Request(url, headers={'User-Agent': NAVEGADOR})
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError:
        return raw.decode('cp1252', errors='replace')


class _SemTachado(HTMLParser):
    """HTML → texto; descarta <strike>/<s>/<del>, estilo line-through, <script> e <style>."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pilha, self.saida, self.pular = [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag == 'br':
            self.saida.append('\n')
            return
        if tag in VAZIAS:
            return
        estilo = (dict(attrs).get('style') or '').lower().replace(' ', '')
        oculto = tag in ('strike', 's', 'del', 'script', 'style') or 'line-through' in estilo
        self.pilha.append((tag, oculto))
        self.pular += oculto

    def handle_endtag(self, tag):
        if tag in VAZIAS:
            return
        for i in range(len(self.pilha) - 1, -1, -1):
            if self.pilha[i][0] == tag:
                self.pular -= sum(o for _, o in self.pilha[i:])
                del self.pilha[i:]
                break
        if not self.pular:
            if tag in ('p', 'tr', 'div', 'h1', 'h2', 'h3', 'h4'):
                self.saida.append('\n')
            elif tag in ('td', 'th'):
                self.saida.append(' | ')

    def handle_data(self, d):
        if not self.pular:
            self.saida.append(d)


def texto_sem_tachado(html):
    p = _SemTachado()
    p.feed(html)
    t = re.sub(r'[ \t\xa0\r]+', ' ', ''.join(p.saida))
    return re.sub(r'\n\s*\n+', '\n', t)


def celulas(texto, juntar_linhas):
    t = re.sub(r'\s+', ' ', texto) if juntar_linhas else texto.replace('\n', '|')
    return [c.strip() for c in t.split('|') if c.strip()]


def num(s):
    s = s.replace('%', '').replace('(*)', '').strip()
    if s in ('-', '–', '_'):
        return D('0')
    return D(s.replace('.', '').replace(',', '.'))


def ler_bloco(cs):
    nominal, partilha, cab, teto = {}, {}, None, None
    i = 0
    while i < len(cs):
        m = re.match(r'^([1-6])[ªa] Faixa$', cs[i])
        if m:
            n = int(m.group(1))
            if n not in nominal and (cs[i + 1].startswith('Até') or cs[i + 1].startswith('De ')):
                nominal[n] = (cs[i + 1], num(cs[i + 2]), num(cs[i + 3]))
                i += 4
                continue
            if n not in partilha and cab:
                vals, j = [], i + 1
                while j < len(cs) and len(vals) < len(cab) and re.match(r'^[\d,]+%( \(\*\))?$|^-$', cs[j]):
                    vals.append(num(cs[j]))
                    j += 1
                partilha[n] = dict(zip(cab, vals))
                i = j
                continue
        if cs[i] == 'IRPJ' and cab is None:
            cab, j = [], i
            while cs[j] in COLUNAS:
                cab.append(cs[j].replace(' (*)', ''))
                j += 1
            i = j
            continue
        if cs[i].startswith('5ª Faixa, com alíquota'):
            vals, j = {}, i + 1
            for col in cab:
                c = cs[j]
                j += 1
                if col == 'ISS':
                    vals['_iss_fixo'] = num(re.search(r'([\d,]+)%', c).group(1))
                    continue
                mm = re.match(r'\(Alíquota efetiva - ([\d,]+)%\) x ([\d,]+)%', c)
                vals[col], vals['_menos'] = num(mm.group(2)), num(mm.group(1))
            teto = vals
            i = j
            continue
        i += 1
    return nominal, partilha, teto


def comparar(fonte, anexo, nominal, partilha, teto, tabelas):
    erros = []
    faixas = tabelas[anexo]['faixas']
    for n in range(1, 7):
        f = faixas[n - 1]
        faixa_txt, aliq, pd = nominal[n]
        ate = num(re.findall(r'[\d.]+,\d\d', faixa_txt)[-1])
        if D(f['ate']) != ate:
            erros.append(f'faixa {n}: ate {f["ate"]} != {ate}')
        if D(f['aliquotaNominal']) != aliq:
            erros.append(f'faixa {n}: nominal {f["aliquotaNominal"]} != {aliq}')
        if D(f['parcelaDeduzir']) != pd:
            erros.append(f'faixa {n}: parcela a deduzir {f["parcelaDeduzir"]} != {pd}')
        da_fonte = {k: v for k, v in partilha[n].items() if v != 0 or n < 6}
        do_json = {k: D(v) for k, v in f['reparticao'].items()}
        if da_fonte != do_json:
            erros.append(f'faixa {n}: repartição json={do_json} fonte={da_fonte}')
    t_json = faixas[4].get('tetoIss')
    if bool(teto) != bool(t_json):
        erros.append('teto de ISS presente só de um lado')
    elif teto:
        exc = {k: D(v) for k, v in t_json['reparticaoDoExcedente'].items()}
        src = {k: v for k, v in teto.items() if not k.startswith('_')}
        if exc != src:
            erros.append(f'teto de ISS: excedente json={exc} fonte={src}')
        if not (D(t_json['issFixo']) == teto['_iss_fixo'] == teto['_menos']):
            erros.append('teto de ISS: issFixo')
    print(f'[{fonte}] Anexo {anexo}:', 'OK' if not erros else 'DIVERGE')
    for e in erros:
        print('   ', e)
    return erros


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', default=str(Path(__file__).with_name('anexos-2027.json')))
    ap.add_argument('--lc214')
    ap.add_argument('--res190')
    args = ap.parse_args()
    tabelas = json.load(open(args.json, encoding='utf-8'))
    erros = []

    lc = texto_sem_tachado(obter(URL_LC214, args.lc214))
    for anexo, marca in MARCAS_LC214.items():
        ini = lc.index(marca)
        fim = lc.index('A partir do ano-calendário 2029', ini)
        erros += comparar('LC 214/Planalto', anexo, *ler_bloco(celulas(lc[ini:fim], True)), tabelas)

    rs = texto_sem_tachado(obter(URL_RES190, args.res190))
    ini0 = rs.rindex('Art. 6º Os Anexos I a V da Resolução CGSN nº 140')
    for anexo in ('I', 'II', 'III', 'IV', 'V'):
        ini = rs.index(f'ANEXO {anexo} da Resolução CGSN nº 140', ini0)
        fim = rs.index('A partir do ano-calendário 2029', ini)
        erros += comparar('Res. CGSN 190/DOU', anexo, *ler_bloco(celulas(rs[ini:fim], False)), tabelas)

    for anexo, t in tabelas.items():
        for n, f in enumerate(t['faixas'], 1):
            if sum(D(v) for v in f['reparticao'].values()) != 100:
                erros.append(f'soma da repartição {anexo} faixa {n} != 100')
        teto = t['faixas'][4].get('tetoIss')
        if teto and sum(D(v) for v in teto['reparticaoDoExcedente'].values()) != 100:
            erros.append(f'soma do excedente do teto de ISS {anexo} != 100')

    print('TOTAL DE DIVERGÊNCIAS:', len(erros))
    sys.exit(1 if erros else 0)


if __name__ == '__main__':
    main()
