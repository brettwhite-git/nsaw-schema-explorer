#!/bin/sh
cd "$(dirname "$0")"
./shot.sh contact-1440 1440x900 "view=looks" & ./shot.sh contact-1920 1920x1200 "view=looks" & ./shot.sh cutout-1920 1920x1200 "view=cut" & wait
for l in a b c; do ./shot.sh look-$l-1920 1920x1200 "look=$l" & done; wait
for l in d e; do ./shot.sh look-$l-1920 1920x1200 "look=$l" & done; ./shot.sh set-a-1920 1920x1200 "view=set&look=a" & wait
./shot.sh set-c-1920 1920x1200 "view=set&look=c" & ./shot.sh faces-a-1920 1920x1200 "view=faces&look=a" & ./shot.sh set-a-1440 1440x900 "view=set&look=a" & wait
./shot.sh shop-a-1920 1920x1200 "look=a&scene=shop" & ./shot.sh shop-c-1920 1920x1200 "look=c&scene=shop" & ./shot.sh title-a-1920 1920x1200 "look=a&scene=title" & wait
./shot.sh title-c-1920 1920x1200 "look=c&scene=title" & ./shot.sh set-c-1440 1440x900 "view=set&look=c" & ./shot.sh faces-c-1920 1920x1200 "view=faces&look=c" & wait
echo finished > shots/looks/.done
