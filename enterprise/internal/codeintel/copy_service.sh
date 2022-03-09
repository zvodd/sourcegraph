#!/bin/bash

cp -r ./template_service "$1"
sed -i '.bak' "s/template_service/template/g" "./$1"/*
sed -i '.bak' "s/template/$1/g" "./$1"/*
find . -type f -name '*.bak' -delete
