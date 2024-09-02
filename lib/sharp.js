const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

class Converter {
  constructor(path, realName, out_name, dith, cf) {
    console.log(7, path, realName, out_name, dith, cf)
    this.dith = dith;
    this.out_name = out_name;
    this.path = path;
    this.cf = cf;
    this.metaready = false

    this.img = sharp(path);
    this.img.metadata().then(metadata => {
      this.w = metadata.width;
      this.h = metadata.height;
      this.rEarr = new Array(this.w + 2).fill(0);
      this.gEarr = new Array(this.w + 2).fill(0);
      this.bEarr = new Array(this.w + 2).fill(0);
      this.metaready = true
    }).catch(err => {
      console.error('Unable to read image metadata', err);
    });
    this.rNerr = 0;
    this.gNerr = 0;
    this.bNerr = 0;
  }

  convert(cf, alpha = 0, cbk=false) {
    this.cf = cf;
    this.alpha = alpha;

    if (this.cf === 'raw' || this.cf === 'raw_alpha' || this.cf === 'raw_chroma') {
      this.dOut = Array.from(fs.readFileSync(this.path));
      return;
    }

    let paletteSize = 0;
    if (this.cf === 'indexed_1_bit') paletteSize = 2;
    if (this.cf === 'indexed_2_bit') paletteSize = 4;
    if (this.cf === 'indexed_4_bit') paletteSize = 16;
    if (this.cf === 'indexed_8_bit') paletteSize = 256;
    let _this = this;
    function insureConvert() {
      for (let y = 0; y < _this.h; y++) {
        _this.dithReset();
        for (let x = 0; x < _this.w; ++x) {
          _this.convPx(x, y);
        }
      }
      cbk()
    }
    this.img.ensureAlpha().raw().toBuffer((err, data, info) => {
      if(paletteSize){
        sharp(_this.path).resize(_this.w, _this.h).toBuffer().then(buff=>{
          _this.img = buff;
          return sharp(buff).ensureAlpha().raw().toBuffer()
        }).then(data =>{
          const pixels = new Uint8Array(data)
          for(let i=0,il=pixels.length;i<il; i+=4) {
            _this.dOut.push(pixels[i+2], pixels[i+1], pixels[i], 0xFF)
          }
          insureConvert.bind(_this)()
        })
      } else {
        _this.dOut = Array.from(data)
        insureConvert.bind(_this)()
      }
    })
  }

  format_to_c_array() {
    let cArray = '';
    let i = 0;
    let yEnd = this.h;
    let xEnd = this.w;

    if (this.cf === 'true_color_332') {
      cArray += "\n#if LV_COLOR_DEPTH == 1 || LV_COLOR_DEPTH == 8";
      if (!this.alpha) cArray += "\n  /*Pixel format: Blue: 2 bit, Green: 3 bit, Red: 3 bit*/";
      else cArray += "\n  /*Pixel format: Blue: 2 bit, Green: 3 bit, Red: 3 bit, Alpha 8 bit */";
    } else if (this.cf === 'true_color_565') {
      cArray += "\n#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP == 0";
      if (!this.alpha) cArray += "\n  /*Pixel format: Blue: 5 bit, Green: 6 bit, Red: 5 bit*/";
      else cArray += "\n  /*Pixel format: Blue: 5 bit, Green: 6 bit, Red: 5 bit, Alpha 8 bit*/";
    } else if (this.cf === 'true_color_565_swap') {
      cArray += "\n#if LV_COLOR_DEPTH == 16 && LV_COLOR_16_SWAP != 0";
      if (!this.alpha) cArray += "\n  /*Pixel format: Blue: 5 bit, Green: 6 bit, Red: 5 bit BUT the 2 bytes are swapped*/";
      else cArray += "\n  /*Pixel format:  Blue: 5 bit Green: 6 bit, Red: 5 bit, Alpha 8 bit  BUT the 2 color bytes are swapped*/";
    } else if (this.cf === 'true_color_888') {
      cArray += "\n#if LV_COLOR_DEPTH == 32";
      if (!this.alpha) cArray += "\n  /*Pixel format: Blue: 8 bit, Green: 8 bit, Red: 8 bit, Fix 0xFF: 8 bit, */";
      else cArray += "\n  /*Pixel format:  Blue: 8 bit, Green: 8 bit, Red: 8 bit, Alpha: 8 bit*/";
    } else if (this.cf === 'indexed_1_bit') {
      cArray += "\n";
      for (let p = 0; p < 2; p++) {
        cArray += "  0x" + this.dOut[p * 4 + 0].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 1].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 2].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 3].toString(16).padStart(2, '0') + ", ";
        cArray += "\t/*Color of index " + p + "*/\n";
      }
      i = 8;
    } else if (this.cf === 'indexed_2_bit') {
      cArray += "\n";
      for (let p = 0; p < 4; p++) {
        cArray += "  0x" + this.dOut[p * 4 + 0].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 1].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 2].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 3].toString(16).padStart(2, '0') + ", ";
        cArray += "\t/*Color of index " + p + "*/\n";
      }
      i = 16;
    } else if (this.cf === 'indexed_4_bit') {
      cArray += "\n";
      for (let p = 0; p < 16; p++) {
        cArray += "  0x" + this.dOut[p * 4 + 0].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 1].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 2].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 3].toString(16).padStart(2, '0') + ", ";
        cArray += "\t/*Color of index " + p + "*/\n";
      }
      i = 64;
    } else if (this.cf === 'indexed_8_bit') {
      cArray += "\n";
      for (let p = 0; p < 256; p++) {
        cArray += "  0x" + this.dOut[p * 4 + 0].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 1].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 2].toString(16).padStart(2, '0') + ", ";
        cArray += "0x" + this.dOut[p * 4 + 3].toString(16).padStart(2, '0') + ", ";
        cArray += "\t/*Color of index " + p + "*/\n";
      }
      i = 1024;
    } else if (this.cf === 'raw' || this.cf === 'raw_alpha' || this.cf === 'raw_chroma') {
      yEnd = 1;
      xEnd = this.dOut.length;
      i = 0;
    }

    for (let y = 0; y < yEnd; y++) {
      cArray += "\n  ";
      for (let x = 0; x < xEnd; x++) {
        if (this.cf === 'true_color_332') {
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
          if (this.alpha) {
            cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
            i++;
          }
        } else if (this.cf === 'true_color_565' || this.cf === 'true_color_565_swap') {
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
          if (this.alpha) {
            cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
            i++;
          }
        } else if (this.cf === 'true_color_888') {
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
        } else if (this.cf === 'indexed_1_bit' || this.cf === 'alpha_1_bit') {
          if ((x & 0x7) === 0) {
            cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
            i++;
          }
        } else if (this.cf === 'indexed_2_bit' || this.cf === 'alpha_2_bit') {
          if ((x & 0x3) === 0) {
            cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
            i++;
          }
        } else if (this.cf === 'indexed_4_bit' || this.cf === 'alpha_4_bit') {
          if ((x & 0x1) === 0) {
            cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
            i++;
          }
        } else if (this.cf === 'indexed_8_bit' || this.cf === 'alpha_8_bit') {
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          i++;
        } else if (this.cf === 'raw' || this.cf === 'raw_alpha' || this.cf === 'raw_chroma') {
          cArray += "0x" + this.dOut[i].toString(16).padStart(2, '0') + ", ";
          if (i !== 0 && ((i % 16) === 0)) cArray += "\n  ";
          i++;
        }
      }
    }

    if (this.cf === 'true_color_332' || this.cf === 'true_color_565' || this.cf === 'true_color_565_swap' || this.cf === 'true_color_888') {
      cArray += "\n#endif";
    }

    return cArray;
  }
  getCHeader() {
    let cHeader = `#ifdef __has_include
  #if __has_include("lvgl.h")
    #ifndef LV_LVGL_H_INCLUDE_SIMPLE
      #define LV_LVGL_H_INCLUDE_SIMPLE
    #endif
  #endif
#endif

#if defined(LV_LVGL_H_INCLUDE_SIMPLE)
  #include "lvgl.h"
#else
  #include "../lvgl/lvgl.h"
#endif

#ifndef LV_ATTRIBUTE_MEM_ALIGN
  #define LV_ATTRIBUTE_MEM_ALIGN
#endif

#ifndef LV_ATTRIBUTE_IMG_${this.out_name.toUpperCase()}
  #define LV_ATTRIBUTE_IMG_${this.out_name.toUpperCase()}
#endif

const LV_ATTRIBUTE_MEM_ALIGN LV_ATTRIBUTE_LARGE_CONST LV_ATTRIBUTE_IMG_${this.out_name.toUpperCase()} uint8_t ${this.out_name}_map[] = {`;

    return cHeader;
  }


  getCFooter(cf) {
    let cFooter = `\n};\n
const lv_img_dsc_t ${this.out_name} = {
  .header.always_zero = 0,
  .header.reserved = 0,
  .header.w = ${this.w},
  .header.h = ${this.h},\n`;

    if (cf === 'true_color') {
      cFooter += `  .data_size = ${this.w * this.h} * LV_COLOR_SIZE / 8,\n  .header.cf = LV_IMG_CF_TRUE_COLOR,`;
    } else if (cf === 'true_color_alpha') {
      cFooter += `  .data_size = ${this.w * this.h} * LV_IMG_PX_SIZE_ALPHA_BYTE,\n  .header.cf = LV_IMG_CF_TRUE_COLOR_ALPHA,`;
    } else if (cf === 'true_color_chroma') {
      cFooter += `  .data_size = ${this.w * this.h} * LV_COLOR_SIZE / 8,\n  .header.cf = LV_IMG_CF_TRUE_COLOR_CHROMA_KEYED,`;
    } else if (cf === 'alpha_1_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_ALPHA_1BIT,`;
    } else if (cf === 'alpha_2_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_ALPHA_2BIT,`;
    } else if (cf === 'alpha_4_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_ALPHA_4BIT,`;
    } else if (cf === 'alpha_8_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_ALPHA_8BIT,`;
    } else if (cf === 'indexed_1_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_INDEXED_1BIT,`;
    } else if (cf === 'indexed_2_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_INDEXED_2BIT,`;
    } else if (cf === 'indexed_4_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_INDEXED_4BIT,`;
    } else if (cf === 'indexed_8_bit') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_INDEXED_8BIT,`;
    } else if (cf === 'raw') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_RAW,`;
    } else if (cf === 'raw_alpha') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_RAW_ALPHA,`;
    } else if (cf === 'raw_chroma') {
      cFooter += `  .data_size = ${this.dOut.length},\n  .header.cf = LV_IMG_CF_RAW_CHROMA_KEYED,`;
    }

    cFooter += `\n  .data = ${this.out_name}_map,
};`;
    return cFooter;
  }

  download_c(name, cf = -1, content = '') {
    if (content.length < 1) {
      content = this.format_to_c_array();
    }

    if (cf < 0) cf = this.cf;

    let out = this.getCHeader() + content + this.getCFooter(cf);
    let fileName = name + '.c';
    fs.writeFileSync(fileName, out);
  }

  download_bin(name, cf = -1, content = null) {
    if (content === null) {
      content = this.dOut;
    }

    if (cf < 0) cf = this.cf;
    let fileName = name + '.bin';

    let lvCf = 4; // Default to LV_IMG_CF_TRUE_COLOR
    switch (cf) {
      case 'true_color':
        lvCf = 4;
        break;
      case 'true_color_alpha':
        lvCf = 5;
        break;
      case 'true_color_chroma':
        lvCf = 6;
        break;
      case 'indexed_1':
      case 'indexed_1_bit':
        lvCf = 7;
        break;
      case 'indexed_2':
      case 'indexed_2_bit':
        lvCf = 8;
        break;
      case 'indexed_4':
      case 'indexed_4_bit':
        lvCf = 9;
        break;
      case 'indexed_8':
      case 'indexed_8_bit':
        lvCf = 10;
        break;
      case 'alpha_1':
      case 'alpha_1_bit':
        lvCf = 11;
        break;
      case 'alpha_2':
      case 'alpha_2_bit':
        lvCf = 12;
        break;
      case 'alpha_4':
      case 'alpha_4_bit':
        lvCf = 13;
        break;
      case 'alpha_8':
      case 'alpha_8_bit':
        lvCf = 14;
        break;
      case 'raw':
        lvCf = 15;
        break;
      case 'raw_alpha':
        lvCf = 16;
        break;
      case 'raw_chroma':
        lvCf = 17;
        break;
    }

    let header = lvCf + (this.w << 10) + (this.h << 21);
    let headerBin = Buffer.alloc(4);
    headerBin.writeUInt32LE(header, 0);

    let contentBin = Buffer.from(content);

    let out = Buffer.concat([headerBin, contentBin]);

    fs.writeFileSync(fileName, out);
  }

  convPx(x, y) {
    let index = (y * this.w + x) * 4;
    let r = this.dOut[index];
    let g = this.dOut[index + 1];
    let b = this.dOut[index + 2];
    let a = this.dOut[index + 3];

    if (this.alpha) {
      if (a & 0x02) a |= 0x01; // Repeat the last bit: 0000000 -> 00000000; 1111110 -> 11111111
      a = 255 - a;
    } else {
      a = 0xff;
    }

    this.dithNext(r, g, b, x);

    if (this.cf === 'true_color_332') {
      let c8 = (this.rAct) | (this.gAct >> 3) | (this.bAct >> 6);
      this.dOut[index] = c8;
      if (this.alpha) this.dOut[index + 3] = a;
    } else if (this.cf === 'true_color_565') {
      let c16 = (this.rAct) | (this.gAct) | (this.bAct >> 3);
      this.dOut[index] = c16 & 0xFF;
      this.dOut[index + 1] = (c16 >> 8) & 0xFF;
      if (this.alpha) this.dOut[index + 3] = a;
    } else if (this.cf === 'true_color_565_swap') {
      let c16 = (this.rAct << 8) | (this.gAct << 3) | (this.bAct >> 3);
      this.dOut[index] = (c16 >> 8) & 0xFF;
      this.dOut[index + 1] = c16 & 0xFF;
      if (this.alpha) this.dOut[index + 3] = a;
    } else if (this.cf === 'true_color_888') {
      this.dOut[index] = b;
      this.dOut[index + 1] = g;
      this.dOut[index + 2] = r;
      this.dOut[index + 3] = a;
    } else if (this.cf === 'alpha_1_bit') {
      let w = this.w >> 3;
      if (this.w & 0x07) w++;
      let p = w * y + (x >> 3);
      if (!this.dOut[p]) this.dOut[p] = 0; // Clear the bits first
      if (a > 0x80) {
        this.dOut[p] |= 1 << (7 - (x & 0x7));
      }
    } else if (this.cf === 'alpha_2_bit') {
      let w = this.w >> 2;
      if (this.w & 0x03) w++;
      let p = w * y + (x >> 2);
      if (!this.dOut[p]) this.dOut[p] = 0; // Clear the bits first
      this.dOut[p] |= (a >> 6) << (6 - ((x & 0x3) * 2));
    } else if (this.cf === 'alpha_4_bit') {
      let w = this.w >> 1;
      if (this.w & 0x01) w++;
      let p = w * y + (x >> 1);
      if (!this.dOut[p]) this.dOut[p] = 0; // Clear the bits first
      this.dOut[p] |= (a >> 4) << (4 - ((x & 0x1) * 4));
    } else if (this.cf === 'alpha_8_bit') {
      let p = this.w * y + x;
      this.dOut[p] = a;
    } else if (this.cf === 'indexed_1_bit') {
      let w = this.w >> 3;
      if (this.w & 0x07) w++;
      let p = w * y + (x >> 3) + 8; // +8 for the palette
      if (!this.dOut[p]) this.dOut[p] = 0; // Clear the bits first
      this.dOut[p] |= (this.dOut[index] & 0x1) << (7 - (x & 0x7));
    } else if (this.cf === 'indexed_2_bit') {
      let w = this.w >> 2;
      if (this.w & 0x03) w++;
      let p = w * y + (x >> 2) + 16; // +16 for the palette
      if (!this.dOut[p]) this.dOut[p] = 0; // Clear the bits first
      this.dOut[p] |= (this.dOut[index] & 0x3) << (6 - ((x & 0x3) * 2));
    } else if (this.cf === 'indexed_4_bit') {
      let w = this.w >> 1;
      if (this.w & 0x01) w++;
      let p = w * y + (x >> 1) + 64; // +64 for the palette
      if (!this.dOut[p]) this.dOut[p] = 0; // Clear the bits first
      this.dOut[p] |= (this.dOut[index] & 0xF) << (4 - ((x & 0x1) * 4));
    } else if (this.cf === 'indexed_8_bit') {
      let p = this.w * y + x + 1024; // +1024 for the palette
      this.dOut[p] = this.dOut[index] & 0xFF;
    }
  }

  dithReset() {
    if (this.dith) {
      this.rNerr = 0;
      this.gNerr = 0;
      this.bNerr = 0;
    }
  }

  dithNext(r, g, b, x) {
    function round_half_up(n) {
      if(n < 0) {
          /* Ugly hack that makes sure -1.5 rounds to -2 */
          n -= 0.0000001;
      }
      return Math.round(n);
    }
    function doCFInit(){
      if (this.cf === 'true_color_332') {
        this.rAct = this.classifyPixel(this.rAct, 3);
        this.gAct = this.classifyPixel(this.gAct, 3);
        this.bAct = this.classifyPixel(this.bAct, 2);

        if (this.rAct > 0xE0) this.rAct = 0xE0;
        if (this.gAct > 0xE0) this.gAct = 0xE0;
        if (this.bAct > 0xC0) this.bAct = 0xC0;
      } else if (this.cf === 'true_color_565' || this.cf === 'true_color_565_swap') {
        this.rAct = this.classifyPixel(this.rAct, 5);
        this.gAct = this.classifyPixel(this.gAct, 6);
        this.bAct = this.classifyPixel(this.bAct, 5);

        if (this.rAct > 0xF8) this.rAct = 0xF8;
        if (this.gAct > 0xFC) this.gAct = 0xFC;
        if (this.bAct > 0xF8) this.bAct = 0xF8;
      } else if (this.cf === 'true_color_888') {
        this.rAct = this.classifyPixel(this.rAct, 8);
        this.gAct = this.classifyPixel(this.gAct, 8);
        this.bAct = this.classifyPixel(this.bAct, 8);

        if (this.rAct > 0xFF) this.rAct = 0xFF;
        if (this.gAct > 0xFF) this.gAct = 0xFF;
        if (this.bAct > 0xFF) this.bAct = 0xFF;
      }
    }

    if (this.dith) {
      this.rAct = r + this.rNerr + this.rEarr[x + 1];
      this.rEarr[x + 1] = 0;

      this.gAct = g + this.gNerr + this.gEarr[x + 1];
      this.gEarr[x + 1] = 0;

      this.bAct = b + this.bNerr + this.bEarr[x + 1];
      this.bEarr[x + 1] = 0;

      doCFInit.bind(this)();

      this.rErr = r - this.rAct;
      this.gErr = g - this.gAct;
      this.bErr = b - this.bAct;

      this.rNerr = round_half_up((7 * this.rErr) / 16);
      this.gNerr = round_half_up((7 * this.gErr) / 16);
      this.bNerr = round_half_up((7 * this.bErr) / 16);

      this.rEarr[x] += round_half_up((3 * this.rErr) / 16);
      this.gEarr[x] += round_half_up((3 * this.gErr) / 16);
      this.bEarr[x] += round_half_up((3 * this.bErr) / 16);

      this.rEarr[x + 1] += round_half_up((5 * this.rErr) / 16);
      this.gEarr[x + 1] += round_half_up((5 * this.gErr) / 16);
      this.bEarr[x + 1] += round_half_up((5 * this.bErr) / 16);

      this.rEarr[x + 2] += round_half_up(this.rErr / 16);
      this.gEarr[x + 2] += round_half_up(this.gErr / 16);
      this.bEarr[x + 2] += round_half_up(this.bErr / 16);
    } else {
      doCFInit.bind(this)()
    }
  }

  classifyPixel(value, bits) {
    let tmp = 1 << (8 - bits);
    let val = Math.round(value / tmp) * tmp;
    if (val < 0) val = 0;
    return val;
  }
}
Converter.CF_TRUE_COLOR_332 = 0;
Converter.CF_TRUE_COLOR_565 = 1;
Converter.CF_TRUE_COLOR_565_SWAP = 2;
Converter.CF_TRUE_COLOR_888 = 3;
Converter.CF_ALPHA_1_BIT = 4;
Converter.alpha_1 = 4;
Converter.CF_ALPHA_2_BIT = 5;
Converter.alpha_2 = 5;
Converter.CF_ALPHA_4_BIT = 6;
Converter.alpha_4 = 6;
Converter.CF_ALPHA_8_BIT = 7;
Converter.alpha_4 = 7;
Converter.CF_INDEXED_1_BIT = 8;
Converter.indexed_1 = 8;
Converter.CF_INDEXED_2_BIT = 9;
Converter.indexed_2 = 9;
Converter.CF_INDEXED_4_BIT = 10;
Converter.indexed_4 = 10;
Converter.CF_INDEXED_8_BIT = 11;
Converter.indexed_8 = 11;
Converter.CF_RAW = 12;
Converter.raw = 12;
Converter.CF_RAW_ALPHA = 13;
Converter.raw_alpha = 13;
Converter.CF_RAW_CHROMA = 12;
Converter.raw_chroma = 12;
Converter.CF_TRUE_COLOR = 100;
Converter.true_color = 100;
Converter.CF_TRUE_COLOR_ALPHA = 101;
Converter.true_color_alpha = 101;
Converter.CF_TRUE_COLOR_CHROMA = 102;
Converter.true_color_chroma = 102;

module.exports = Converter;