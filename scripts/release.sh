#!/usr/bin/env bash

OPTIND=1
version='0.0.0'
releaseMsg=`git log -1 --pretty=%B`

while getopts ":v:" opt; do
    case "$opt" in
    v)
        version=$OPTARG
    ;;
    \?)
        echo "Invalid option: -$OPTARG" >&2
        exit 1
    ;;
    esac
done

shift $((OPTIND-1))

RELEASE_BRANCH="release_$version"

echo "creating release branch with version $version"

git fetch --all

git co -b $RELEASE_BRANCH origin/dev

sudo chmod -R 777 .

./scripts/build-static.sh

git rm "TODO.md"
git rm ".foreverignore"
git rm "configuration/connections.js"
git rm "mocha-bootstrap.js"
git rm -r "scripts"
git rm -r "test"
git rm -r "tests-client"

git rm ./.gitignore

git mv ./.masterignore ./.gitignore

find ./static/images -name "*upload*" -type f -delete

git add static/*

git co origin/master README.md

#delete tag if exists
git tag -d "v$version"

git ci -m "release $version"
git tag -a "v$version" -m "$releaseMsg"

git push --tags

git co master
#git pull --rebase
git reset --hard origin/master

git co -b tmp $RELEASE_BRANCH
git merge -s ours master
git co master
git merge tmp

#git merge --no-ff $RELEASE_BRANCH

git branch -D tmp
git branch -D $RELEASE_BRANCH

git push origin master

git co dev
git reset --hard origin/dev

sudo chmod -R 777 .

