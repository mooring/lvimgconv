const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const Converter = require('./sharp');
// 定义允许的枚举值
const BF_VALUES = {
    ARGB8332:1,
    bin_332:1,
    '332':1,
    ARGB8565:1,
    bin_565:1,
    '565':1,
    ARGB8565_RBSWAP:1,
    bin_565_swap:1,
    '565_swap': 1,
    ARGB8888: 1,
    bin_888: 1,
    '888': 1,
};
function parseArgs(argv=[]) {
  // 解析命令行参数
  const args = minimist(argv.slice(2), {
    alias: {
      o: 'output-file',
      i: 'image-name',
      c: 'color-format',
      t: 'output-format',
      f: 'force',
      d: 'dither',
      s: 'swap-endian',
      v: 'version',
      h: 'help',
    },
    boolean: ['force', 'dither', 'swap-endian', 'version', 'help']
  });

  // 获取非选项参数
  const nonOptionArgs = args._;

  // 检查必填参数
  if (nonOptionArgs.length === 0) {
    return {errcode: 1, errmsg: 'please specify image file'}
  }
  // 检查 -c 或 --color-format 参数是否存在并且是允许的枚举值
  let cfval = args.c || args['color-format'] || '';
  if(cfval && !(cfval in Converter)) {
    return {errcode: 1, errmsg: 'invalid -c value'}
  }
  cfval = (cfval || 'true_color').replace(/^cf_/i, '').toLowerCase()
  let output_format = (args.t || args['output-format'] || '').toLowerCase()
  if(output_format && !/^(c|bin)$/i.test(output_format)) {
    return {errcode: 1, errmsg: 'invalid output-format value'}
  }
  output_format = output_format || 'c_array'
  let binary_format = args['binary-format'] || ''
  if(/^bin/.test(output_format)) {
    if(!binary_format) {
      return {errcode: 1, errmsg: 'binary output format must specify --binary-format param'}
    } else if(!(binary_format in BF_VALUES)) {
      return {errcode: 1, errmsg: 'binary format must be one of '+Object.keys(BF_VALUES).join('/')}
    }
    if(output_format == 'bin'){
      output_format = 'bin_565'
    }
  }
  // 设置变量
  const img_file = nonOptionArgs[0];
  const img_file_name = path.basename(img_file);
  const base_name = path.basename(args.o || args['output-file'] || img_file_name)
  const output_name = base_name.replace(path.extname(base_name), '');
  const force = args.f === false || args.f === true ? args.f : args.force === true || args.force === false ? args.force : false;
  const dith = args.d || args.dither || false;
  const swap_endian = args.s || args['swap-endian'] || false
  const file_path = path.resolve(img_file)
  if(!fs.existsSync(file_path)){
    return {errcode:1, errmsg: `image file not found: ${img_file}`}
  }
  return {
    force,
    dith,
    img_file,
    img_file_name,
    output_name,
    output_format,
    binary_format,
    swap_endian,
    cf: cfval,
    errcode: 0
  };
}

function strcmp(str1, str2) {
    if (str1 === str2) {
        return 0;
    }
    const len1 = str1.length;
    const len2 = str2.length;
    const minLen = Math.min(len1, len2);
    for (let i = 0; i < minLen; i++) {
        if (str1[i] < str2[i]) {
            return -1;
        } else if (str1[i] > str2[i]) {
            return 1;
        }
    }
    if (len1 < len2) {
        return -1;
    } else if (len1 > len2) {
        return 1;
    }
    return 0;
}
let conv = null
function process(args) {
  conv = new Converter(args.img_file, args.img_file_name, args.output_name, args.dith, args.cf)
  checkReady(args)
}
function checkReady(args){
  if(conv.metaready){
    readyRun(args)
  } else {
    setTimeout(function(){
      checkReady(args)
    }, 300)
  }
}
async function readyRun(args){
  let alpha = 0, c_332 = '', c_565 = '', c_565_swap = '', c_888 = '', c_res = '';
  const downbin = () => {
    conv.download_c(conv.out_name);
  }
  if(!strcmp(args.output_format, 'c_array')) {
    if(!strcmp(args.cf, 'true_color_alpha') || !strcmp(args.cf,'true_color_chroma')) {
        if(!strcmp(args.cf, 'true_color_alpha')) { 
          alpha = 1;
        }
        conv.convert('true_color_332', alpha, ()=>{
          c_332 = conv.format_to_c_array();
        
          conv.convert('true_color_565', alpha, ()=>{
            c_565 = conv.format_to_c_array();

            conv.convert('true_color_565_swap', alpha, ()=>{
              c_565_swap = conv.format_to_c_array();
            
              conv.convert('true_color_888', alpha, ()=>{
                c_888 = conv.format_to_c_array();
            
                c_res = [c_332, c_565, c_565_swap, c_888].join('');

                if(!strcmp(args.cf, 'true_color')) {
                  conv.download_c(conv.out_name, 'true_color', c_res);
                }
                if(!strcmp(args.cf, 'true_color_alpha')) {
                  conv.download_c(conv.out_name, 'true_color_alpha', c_res);
                }
                if(!strcmp(args.cf, 'true_color_chroma')) {
                  conv.download_c(conv.out_name, 'true_color_chroma', c_res);
                }
              });
            });
          });
        });
    }
    else if(!strcmp(args.cf, 'alpha_1') || !strcmp(args.cf, 'alpha_1_bit')) {
      conv.convert('alpha_1_bit', 1, downbin);
    }
    else if(!strcmp(args.cf, 'alpha_2') || !strcmp(args.cf, 'alpha_2_bit')) {
      conv.convert('alpha_2_bit', 1, downbin);
    }
    else if(!strcmp(args.cf, 'alpha_4') || !strcmp(args.cf, 'alpha_4_bit')) {
      conv.convert('alpha_4_bit', 1, downbin);
    }
    else if(!strcmp(args.cf, 'alpha_8') || !strcmp(args.cf, 'alpha_8_bit')) {
      conv.convert('alpha_8_bit', 1, downbin);
    }
    else if(!strcmp(args.cf, 'indexed_1') || !strcmp(args.cf, 'indexed_1_bit')) {
      conv.convert('indexed_1_bit', 0, downbin);
    }
    else if(!strcmp(args.cf, 'indexed_2') || !strcmp(args.cf, 'indexed_2_bit')) {
      conv.convert('indexed_2_bit', 0, downbin);
    }
    else if(!strcmp(args.cf, 'indexed_4') || !strcmp(args.cf, 'indexed_4_bit')) {
      conv.convert('indexed_4_bit', 0, downbin);
    }
    else if(!strcmp(args.cf, 'indexed_8') || !!strcmp(args.cf, 'indexed_8_bit')) {
      conv.convert('indexed_8_bit', 0, downbin);
    }
    else if(!strcmp(args.cf, 'raw')) {
      conv.convert('raw', 0, downbin);
    }
    else if(!strcmp(args.cf, 'raw_alpha')) {
      conv.convert('raw_alpha', 1, downbin);
    }
    else if(!strcmp(args.cf, 'raw_chroma')) {
      conv.convert('raw_chroma', 0, downbin);
    }
  }
  /*Binary download*/
  else  {
      const after_call = () => {
        if(!strcmp(args.cf, 'true_color')) {
          conv.download_bin(conv.out_name, 'true_color');
        }
        if(!strcmp(args.cf, 'true_color_alpha')) {
          conv.download_bin(conv.out_name, 'true_color_alpha');
        }
        if(!strcmp(args.cf, 'true_color_chroma')) {
          conv.download_bin(conv.out_name, 'true_color_chroma');
        }
      }
      const downbin = () => {
        conv.download_bin(conv.out_name);
      }
      if(!strcmp(args.cf, 'true_color') || !strcmp(args.cf, 'true_color_alpha') || !strcmp(args.cf, 'true_color_chroma')) {
        if(!strcmp(args.cf, 'true_color_alpha')) {
          alpha = 1;
        }
        if (!strcmp(args.output_format, 'bin_332') || !strcmp(args.output_format, '332') || !strcmp(args.output_format, 'argb8332')) {
          conv.convert('true_color_332', alpha, after_call);
        } else if (!strcmp(args.output_format, 'bin_565') || !strcmp(args.output_format, '565') || !strcmp(args.output_format, 'argb8565')) {
          conv.convert('true_color_565', alpha, after_call);
        } else if (!strcmp(args.output_format, 'bin_565_swap') || !strcmp(args.output_format, '565_swap') || !strcmp(args.output_format, 'argb8565_rbswap')) {
          conv.convert('true_color_565_swap', alpha, after_call);
        } else if (!strcmp(args.output_format, 'bin_888')|| !strcmp(args.output_format, '888') || !strcmp(args.output_format, 'argb8888')) {
          conv.convert('true_color_888', alpha, after_call);
        } else {
          console.error(`Unknown output file format: ${args.output_format}`)
        }
      }
      else if(!strcmp(args.cf, 'alpha_1') || !strcmp(args.cf, 'alpha_1_bit')) {
        conv.convert('alpha_1_bit', 1, downbin);
      }
      else if(!strcmp(args.cf, 'alpha_2') || !strcmp(args.cf, 'alpha_2_bit')) {
        conv.convert('alpha_2_bit', 1, downbin);
      }
      else if(!strcmp(args.cf, 'alpha_4') || !strcmp(args.cf, 'alpha_4_bit')) {
        conv.convert('alpha_4_bit', 1, downbin);
      }
      else if(!strcmp(args.cf, 'alpha_8') || !strcmp(args.cf, 'alpha_8_bit')) {
        conv.convert('alpha_8_bit', 1, downbin);
      }
      else if(!strcmp(args.cf, 'indexed_1') || !strcmp(args.cf, 'indexed_1_bit')) {
        conv.convert('indexed_1_bit', 0, downbin);
      }
      else if(!strcmp(args.cf, 'indexed_2') || !strcmp(args.cf, 'indexed_2_bit')) {
        conv.convert('indexed_2_bit', 0, downbin);
      }
      else if(!strcmp(args.cf, 'indexed_4') || !strcmp(args.cf, 'indexed_4_bit')) {
        conv.convert('indexed_4_bit', 0, downbin);
      }
      else if(!strcmp(args.cf, 'indexed_8') || !strcmp(args.cf, 'indexed_8_bit')) {
        conv.convert('indexed_8_bit', 0, downbin);
      }
      
  }
}
module.exports = {
  parseArgs,
  process
};