#!/usr/bin/env bash
# Simple bash installation script for Calipso

# Make sure we have node and npm installed
node=$(node --version)
npm=$(npm --version)
KEY_MODULES=(express mongodb node-expat)

E_ERROR=1

echo "Using Node version: $node"
echo "Using NPM version: $npm"

# Check that we have ok permissions
if [[ -w . ]] ; then
    echo 'You have write permission to the current folder.'
else
    echo "You don't have the required read/write access to the Calipso folder! You need to execute: sudo chmod -R u+rw ." >&2
    exit $E_ERROR
fi

# Check that we are in the root Folder
if [[ -r ./app.js ]] ; then
  echo 'The current folder appears to be Calipso (or something like it!)'
else
  echo 'You need to run this command from the Calipso base folder (not bin).' >&2
  exit $E_ERROR
fi

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

# Lets try npm install
echo "Installing dependencies via NPM ... please be patient this can take a few minutes ..."
npmResult=$(npm install)

# Fix for mongodb native
npmResult=$(npm install mongodb --mongodb:native)

# Quick check of key modules
npm_local=$(npm root)
npm_global=$(npm root -g)
echo 'Checking that key modules are installed...'
for module in "${KEY_MODULES[@]}"; do
    echo -n "  $module module ... "
    if [[ ! -r "$npm_local/$module" ]];then
        if [[ ! -r "$npm_global/$module" ]];then
            echo 'NOT found!'
            echo "NPM failed to install '$module' module. Hint: Try \`npm install $module\`." >&2
            exit $E_ERROR
        else
            echo ' found (in system install).'
        fi
    else
        echo ' found.'
    fi
done

# Run full module install
echo 'Checking all module dependencies ...'
calipso modules check

# Lets try our sanity test
echo 'Running sanity tests ...'
sanityTest=$(make)

# Check to see if we got all 100%
echo 'If you can see 100% success on the sanity tests then you are probably good to go!'
exit $sanityTest
