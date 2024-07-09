#!/bin/bash

set -e

zits --default-zome-name zFiles -d "import {DistributionStrategy, ParcelManifest, ParcelChunk, ParcelDescription, ParcelKind, ParcelReference} from '@ddd-qc/delivery';" -i dna/zomes/path_explorer -i dna/zomes/files -i dna/zomes/files_integrity -o webcomponents/src/bindings/files.ts

zits --default-zome-name zTagging -f "cast_tip" -i dna/zomes/path_explorer -i dna/zomes/tagging -i dna/zomes/tagging_integrity -o webcomponents/src/bindings/tagging.ts
