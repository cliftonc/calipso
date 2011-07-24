#!/usr/bin/env bash
# Checking that you have expat
echo 'Checking for libexpat ...'
os=`uname`
case $os in
  "Darwin")
    expat_loc=`find /usr -name "expat.h" -print`
    ;;
  "Linux")
    expat_loc=`whereis -b expat.h | cut -c8-`
    ;;
esac
if [[ -e "$expat_loc" ]]; then
  echo 'Libexpat OK'
else
  echo "You don't seem to have libexpat-dev installed!  Calipso relies on this library for the node-expat module used to parse XML.  Please install via apt-get (or from source)." >&2
  exit $E_ERROR
fi
