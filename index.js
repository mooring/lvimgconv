const cli = require('./lib/cli')
const VER = '0.1.0'

const args = cli.parseArgs(process.argv)
const help = `Options:
  --help               Show help                                       [boolean]
  --version            Show version number                             [boolean]
  --output-file, -o    output file path (for single-image conversion)   [string]
  --force, -f          allow overwriting the output file               [boolean]
  --image-name, -i     name of image structure                          [string]
  --color-format, -c   color format of image
      [required] [choices: "CF_ALPHA_1_BIT", "CF_ALPHA_2_BIT", "CF_ALPHA_4_BIT",
   "CF_ALPHA_8_BIT", "CF_INDEXED_1_BIT", "CF_INDEXED_2_BIT", "CF_INDEXED_4_BIT",
                  "CF_INDEXED_8_BIT", "CF_RAW", "CF_RAW_CHROMA", "CF_RAW_ALPHA",
  "CF_TRUE_COLOR", "CF_TRUE_COLOR_ALPHA", "CF_TRUE_COLOR_CHROMA", "CF_RGB565A8"]
  --output-format, -t  output format of image
                                            [choices: "c", "bin"] [default: "c"]
  --binary-format      binary color format (needed if output-format is binary)
       [string] [choices: "ARGB8332", "ARGB8565", "ARGB8565_RBSWAP", "ARGB8888"]
  --swap-endian, -s    swap endian of image                            [boolean]
  --dither, -d         enable dither                                   [boolean]`

if(args.version) {
  console.log(VER)
  process.exit(0)
}
if(args.h || args.help){
  console.log(help)
  process.exit(0)
}
if(args.errcode != 0) {
  console.log(help);
  if(args.errmsg){
      console.error(args.errmsg);
  }
  process.exit(0)
}
cli.process(args)