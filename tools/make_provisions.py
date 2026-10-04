"""Deterministic 16px salve, leather Miruvor skin, venison and Lembas icons.

Run with python -B tools/make_provisions.py. Shapes are pixel polygons; material
ramps and intentional folds/cut marks supply detail without random texture noise.
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'lothlorien_rp/textures/items'
CREAM = ['#75614b', '#ab9068', '#c7ae83', '#dfcca1', '#f1e3ba', '#fff2d0']
GOLD = ['#614027', '#966034', '#bb813c', '#d9ab52', '#edcf7b', '#fff0b2']
LEAF = ['#263e38', '#375c46', '#527952', '#77965e', '#a3b97b', '#d2d8a0']
RAW = ['#522a39', '#793445', '#9c4052', '#bc5664', '#d97c80', '#eeaaa0']
COOKED = ['#422824', '#653a2b', '#895037', '#ad7148', '#ce9864', '#e9bd87']
LEATHER = ['#49372d', '#6b4936', '#916442', '#b38655', '#cfa774', '#e4c99a']


class Canvas:
    def __init__(self):
        self.im = Image.new('RGBA', (16, 16))

    def shape(self, points, ramp, light=0):
        mask = Image.new('1', (16, 16))
        ImageDraw.Draw(mask).polygon(points, fill=1)
        x0, y0, x1, y1 = mask.getbbox()
        for y in range(y0, y1):
            for x in range(x0, x1):
                if not mask.getpixel((x, y)):
                    continue
                edge = any(not (0 <= xx < 16 and 0 <= yy < 16) or not mask.getpixel((xx, yy))
                           for xx, yy in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)))
                value = 4.8 - (x-x0)*1.7/max(1,x1-x0-1) - (y-y0)*2.3/max(1,y1-y0-1) + light
                if edge:
                    value -= 1.5 if x > (x0+x1)/2 or y > (y0+y1)/2 else .6
                self.dot(x, y, ramp[max(0, min(len(ramp)-1, round(value)))])

    def dot(self, x, y, colour):
        ImageDraw.Draw(self.im).point((x,y), fill=colour)

    def line(self, points, colour, width=1):
        ImageDraw.Draw(self.im).line(points, fill=colour, width=width)

    def save(self, name):
        assert self.im.size == (16,16)
        assert set(self.im.getchannel('A').getdata()) <= {0,255}
        assert self.im.getbbox() and all(0 < n < 16 for n in self.im.getbbox()[:2])
        assert self.im.getbbox()[2] < 16 and self.im.getbbox()[3] < 16
        self.im.save(OUT / (name+'.png'))


def salve():
    c = Canvas()
    # Short round glass vial; transparent shoulders follow vanilla potion glass.
    c.shape([(6,2),(9,2),(9,4),(6,4)], LEATHER)
    c.line([(5,5),(6,4),(9,4),(10,5)], '#c1e5e6')
    c.shape([(5,7),(10,7),(11,9),(11,12),(10,13),(5,13),(4,12),(4,9)], LEAF, .4)
    c.line([(5,6),(4,8),(3,9),(3,12),(4,13)], '#b5d8e4')
    c.line([(10,6),(11,8),(12,9),(12,12),(11,13),(9,14),(5,14),(4,13)], '#577fa9')
    c.line([(5,8),(5,10)], '#e5f3d3')
    c.line([(6,12),(8,13),(10,12)], '#375c46')
    c.dot(7,8,'#b5ce8b')
    c.line([(8,9),(9,10)], '#77965e')
    c.line([(5,14),(7,14)], '#86adc8')
    c.dot(10,6,'#86adc8')
    c.line([(8,11),(9,10)], '#527952')
    c.save('athelas_salve')
    return c.im


def miruvor():
    c = Canvas()
    # Asymmetric shoulder, narrow spout and a folded leather belly.
    c.line([(9,4),(12,5),(13,7),(12,9)], LEATHER[1])
    c.shape([(8,2),(10,2),(10,4),(8,5)], GOLD)
    c.shape([(7,4),(10,4),(10,6),(12,8),(12,11),(10,14),(5,14),(3,12),(3,9),(5,6),(7,6)], LEATHER)
    c.line([(8,4),(10,4)], GOLD[4])
    c.line([(4,10),(4,12),(6,13),(9,13),(11,11)], LEATHER[0])
    c.line([(5,8),(5,10)], LEATHER[5])
    c.line([(10,8),(10,11),(9,12)], LEATHER[2])
    # Precious cordial's emblem: small gold leaf on the skin, no fake glass.
    c.shape([(7,7),(9,8),(9,9),(7,11),(6,9)], GOLD, .6)
    c.line([(7,10),(8,8)], GOLD[5])
    c.dot(6,12,LEATHER[4]); c.dot(8,13,LEATHER[3])
    c.save('miruvor')
    return c.im


def venison(cooked=False):
    c = Canvas()
    # Narrow rib chop, ivory shank below a triangular cut (not a beef slab).
    c.shape([(4,10),(6,11),(5,12),(4,14),(2,14),(2,12),(3,12)], CREAM)
    c.dot(3,13,CREAM[5])
    ramp = COOKED if cooked else RAW
    c.shape([(7,3),(10,3),(13,5),(13,8),(11,10),(7,12),(4,11),(3,9),(4,6)], ramp)
    c.line([(4,7),(5,5),(8,4),(10,4),(12,5)], COOKED[4] if cooked else CREAM[4])
    c.line([(4,10),(7,11),(10,10),(12,8)], ramp[1])
    if cooked:
        c.line([(6,6),(8,7)], COOKED[0]); c.line([(9,5),(11,6)], COOKED[1])
        c.line([(7,9),(9,8)], COOKED[0])
        c.line([(5,8),(6,9)], COOKED[5])
        c.dot(10,7,COOKED[4])
    else:
        c.line([(5,8),(7,7),(8,8),(10,6)], RAW[5])
        c.line([(7,10),(9,9),(10,9)], RAW[4])
        c.dot(5,6,RAW[5]); c.dot(11,7,RAW[2])
    c.save('venison_cooked' if cooked else 'venison_raw')
    return c.im


def dough():
    c = Canvas()
    c.shape([(5,5),(9,4),(12,6),(13,9),(12,12),(9,13),(4,12),(2,10),(3,7)], CREAM)
    c.line([(4,7),(6,6),(9,6)], CREAM[5])
    c.line([(6,9),(7,8),(9,8)], CREAM[2])
    c.line([(7,10),(9,10),(10,9)], CREAM[4])
    c.line([(4,11),(6,12),(9,12)], CREAM[1])
    c.dot(11,7,CREAM[3]); c.dot(4,9,CREAM[4])
    c.line([(6,7),(8,6)], CREAM[4])
    c.line([(10,10),(11,9)], CREAM[2])
    c.line([(3,10),(5,11)], CREAM[3])
    c.dot(10,5,CREAM[4]); c.dot(12,8,CREAM[3])
    c.line([(5,8),(6,8)], CREAM[4])
    c.line([(5,10),(6,10)], CREAM[2])
    c.line([(9,11),(11,10)], CREAM[1])
    c.save('lembas_dough')
    return c.im


def cake():
    c = Canvas()
    # Square thin waybread in perspective, with a pale scored top and browned edge.
    c.shape([(2,8),(9,4),(13,7),(13,10),(6,14),(2,11)], GOLD, -.6)
    c.shape([(2,7),(9,3),(13,6),(6,11),(2,9)], CREAM, .3)
    c.line([(3,9),(6,11),(12,7)], GOLD[2])
    c.line([(5,6),(9,9)], GOLD[2])
    c.line([(5,9),(10,5)], GOLD[3])
    c.dot(5,5,CREAM[5]); c.dot(10,6,CREAM[3])
    c.dot(7,12,GOLD[4]); c.dot(11,10,GOLD[2])
    c.line([(8,11),(10,10),(12,9)], GOLD[3])
    c.line([(3,10),(5,11)], GOLD[1])
    c.dot(8,4,CREAM[4]); c.dot(11,6,CREAM[2])
    c.dot(7,7,CREAM[5]); c.dot(8,9,CREAM[2])
    c.save('lembas_cake')
    return c.im


def wrapped():
    c = Canvas()
    # Folded silver-backed Mallorn leaf packet; angular flaps, golden fibre tie.
    c.shape([(2,5),(10,3),(13,6),(12,12),(5,14),(2,11)], LEAF)
    c.shape([(2,5),(10,3),(8,8),(5,9)], LEAF, .6)
    c.shape([(3,6),(6,9),(3,11)], ['#526565','#798c81','#a4b8a3','#c9d7bd','#e1e7ce','#f4f0dc'])
    c.line([(10,4),(8,8),(12,11)], LEAF[0])
    c.line([(5,13),(7,10),(11,12)], LEAF[1])
    c.line([(4,5),(6,7),(8,9),(11,12)], GOLD[1])
    c.line([(5,5),(7,7),(9,9),(12,12)], GOLD[4])
    c.line([(3,10),(7,8),(12,6)], GOLD[3])
    c.line([(3,9),(7,7),(12,5)], GOLD[5])
    c.dot(7,8,GOLD[1]); c.dot(8,7,GOLD[5])
    c.save('lembas_wrapped')
    return c.im


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    salve(); miruvor(); venison(); venison(True); dough(); cake(); wrapped()
    print('Wrote seven provision icons')


if __name__ == '__main__':
    main()
