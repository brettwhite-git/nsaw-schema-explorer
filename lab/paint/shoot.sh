#!/bin/sh
# usage: shoot.sh VIEW WxH [extra query]   -> shots/view<N>-<W>.png (headless Chrome, software GL)
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
V=$1; SZ=$2; W=${SZ%x*}
"$CH" --headless=new --disable-gpu-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars --window-size=${W},${SZ#*x} \
  --virtual-time-budget=${BUDGET:-30000} --screenshot="$(dirname "$0")/shots/view$V-$W$3.png" "http://localhost:3001/lab/paint/index.html?view=$V$4" 2>&1 | grep -v -E "^\[|DevTools|dbus" | head -3
