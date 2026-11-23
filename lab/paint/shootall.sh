#!/bin/sh
cd "$(dirname "$0")"
for v in 1 2 3 4 5 6 7 8; do BUDGET=60000 ./shoot.sh $v 1440x900 >/dev/null 2>&1; done
for v in 2 3 4 5 6 7; do BUDGET=60000 ./shoot.sh $v 1920x1200 >/dev/null 2>&1; done
echo finished > shots/.done
