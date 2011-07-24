#!/usr/bin/env bash
# Simple bash installation script for Calipso

# Make sure we have node and npm installed
node=$(node --version)
npm=$(npm --version)
KEY_MODULES=(mongodb)

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

# Check to see if we got all 100%
echo 'Installation completed, please try the command "calipso" to test the installation.'
exit 0
