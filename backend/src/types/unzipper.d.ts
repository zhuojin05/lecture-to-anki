// backend/src/types/unzipper.d.ts
declare module "unzipper" {
  export interface ZipEntry {
    path: string;
    type?: "File" | "Directory";
    buffer(): Promise<Buffer>;
  }
  export interface ParsedZip {
    files: ZipEntry[];
  }
  export const Open: {
    buffer(buf: Buffer): Promise<ParsedZip>;
  };
}

