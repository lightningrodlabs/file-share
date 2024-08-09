import {ParcelKind} from "@ddd-qc/delivery/dist/bindings/delivery.types";
import {ParcelDescription, ParcelKindVariantManifest} from "@ddd-qc/delivery";


/** */
export enum FileType {
    Document = 'Document',
    Pdf = 'PDF',
    Text = 'Text',
    Font = 'Font',
    Image = 'Image',
    Video = 'Video',
    Audio = 'Audio',
    Zip = 'Zip',
    Binary = 'Binary',
    Other = 'Other',
}


/** */
export function type2Icon(type: FileType): string {
    switch (type) {
        case FileType.Document: return "file-earmark-richtext";
        case FileType.Pdf: return "file-earmark-pdf";
        case FileType.Text: return "file-earmark-text";
        case FileType.Font: return "file-earmark-font";
        case FileType.Image: return "image";
        case FileType.Video: return "film";
        case FileType.Audio: return "volume-up";
        case FileType.Zip: return "file-earmark-zip";
        case FileType.Binary: return "file-earmark-binary";
        case FileType.Other: return "file-earmark";
        default: return "file-earmark";
    }
    return "file-earmark";
}


/** */
export function kind2mime(kindInfo: ParcelKind): string {
    let filetype = (kindInfo as ParcelKindVariantManifest).Manifest;
    //console.log("prettyFiletype()", filetype);
    const fields = filetype.split('::');
    if (fields.length > 1) {
        filetype = fields[1]!;
    }
    //console.log("prettyFiletype() res ", filetype);
    return filetype;
}


/** */
export function kind2Type(kindInfo: ParcelKind): FileType {
    const mime = kind2mime(kindInfo);
    const fields = mime.split('/');
    if (fields.length < 2) {
        return FileType.Other;
    }
    if (fields[0] == "image") {
        return FileType.Image;
    };
    if (fields[0] == "video") {
        return FileType.Video;
    };
    if (fields[0] == "audio") {
        return FileType.Audio;
    };
    if (fields[0] == "text") {
        return FileType.Text;
    }
    if (fields[0] == "font") {
        return FileType.Font;
    }
    if (fields[0] == "application") {
        if (fields[1] == "pdf") {
            return FileType.Pdf;
        }
        if (fields[1] == "json") {
            return FileType.Text;
        }
        if (fields[1] == "x-zip-compressed") {
            return FileType.Zip;
        }
        return FileType.Binary
    }
    return FileType.Other;
}


/** */
export function kind2Icon(kindInfo: ParcelKind): string {
    const type = kind2Type(kindInfo);
    return type2Icon(type);
}


export function countFileTypes(descs: ParcelDescription[]): Record<string, number> {
    let map: Record<string, number> = {};
    /** Init map */
    const keys = Object.keys(FileType);
    keys.forEach((key, _index) => {
        map[key] = 0;
    })
    /** */
    for (const desc of descs) {
        const type = kind2Type(desc.kind_info);
        switch (type) {
            case FileType.Document: map[FileType.Document] += 1; break;
            case FileType.Pdf: map[FileType.Pdf] += 1; map[FileType.Document] += 1; break;
            case FileType.Text: map[FileType.Text] += 1; map[FileType.Document] += 1; break;
            case FileType.Font: map[FileType.Font] += 1; break;
            case FileType.Image: map[FileType.Image] += 1; break;
            case FileType.Video: map[FileType.Video] += 1; break;
            case FileType.Audio: map[FileType.Audio] += 1; break;
            case FileType.Zip: map[FileType.Zip] += 1; break;
            case FileType.Binary: map[FileType.Binary] += 1; break;
            case FileType.Other: map[FileType.Other] += 1; break;
            default: map[FileType.Other] += 1;
        }
    }
    /** Done */
    return map;
}
