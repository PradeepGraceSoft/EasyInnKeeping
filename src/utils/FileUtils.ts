import fs from 'fs';
import path from 'path';

export class FileUtils {

    static readJson<T>(filePath: string): T {

        const content = fs.readFileSync(
            path.resolve(filePath),
            'utf-8'
        );

        return JSON.parse(content);
    }

    static writeJson(
        filePath: string,
        data: unknown
    ): void {

        fs.writeFileSync(
            path.resolve(filePath),
            JSON.stringify(data, null, 2)
        );
    }

    static fileExists(filePath: string): boolean {

        return fs.existsSync(
            path.resolve(filePath)
        );
    }

    static createDirectory(directory: string): void {

        const fullPath = path.resolve(directory);

        if (!fs.existsSync(fullPath)) {

            fs.mkdirSync(fullPath, {
                recursive: true
            });
        }
    }

    static deleteFile(filePath: string): void {

        if (this.fileExists(filePath)) {

            fs.unlinkSync(
                path.resolve(filePath)
            );
        }
    }

    static readTextFile(filePath: string): string {

        return fs.readFileSync(
            path.resolve(filePath),
            'utf8'
        );
    }
}