#!/bin/sh
# usage: shot.sh OUTNAME WxH "query"  -> shots/looks/OUTNAME.png (headless Chrome, software GL; timings in captions are virtual-time and meaningless)
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SZ=$2; W=${SZ%x*}
"$CH" --headless=new --disable-gpu-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=${W},${SZ#*x} \
  --virtual-time-budget=${BUDGET:-90000} --screenshot="$(dirname "$0")/shots/looks/$1.png" "http://localhost:3001/lab/paint/index.html?$3" 2>&1 | grep -E "written|rror" | head -3
