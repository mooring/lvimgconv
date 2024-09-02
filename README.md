# convert png to lvgl format in c and binary

## node 14

```bash
node index.js test.png -f -c CF_TRUE_COLOR
```

## to binary for distribution

```
nvm use 14
npm i -g pkg
npm i
pkg -o lv_img_conv index.js
```
