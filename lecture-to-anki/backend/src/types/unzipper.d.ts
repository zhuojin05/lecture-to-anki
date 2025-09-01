// backend/src/types/unzipper.d.ts
declare module "unzipper" {
  export interface Entry {
    path: string;
    type?: "File" | "Directory";
    buffer(): Promise<Buffer>;
  }
  export interface ParsedZip {
    files: Entry[];
  }
  export const Open: {
    buffer(buf: Buffer): Promise<ParsedZip>;
  };
}

