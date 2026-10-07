export class Logger {

    static isEnabled(): boolean {
        return process.env.PWDEBUG === "1" || process.env.DEBUG === "true";
    }

    private static timestamp(): string {
        return new Date().toISOString();
    }

    static info(message: string): void {
        if (!this.isEnabled()) return;
        console.log(
            `[INFO] [${this.timestamp()}] ${message}`
        );
    }

    static warn(message: string): void {
        if (!this.isEnabled()) return;
        console.warn(
            `[WARN] [${this.timestamp()}] ${message}`
        );
    }

    static error(message: string, error?: unknown): void {

        if (!this.isEnabled()) return;

        console.error(
            `[ERROR] [${this.timestamp()}] ${message}`
        );

        if (error) {
            console.error(error);
        }
    }

    static debug(message: string): void {

        if (this.isEnabled()) {

            console.debug(
                `[DEBUG] [${this.timestamp()}] ${message}`
            );
        }
    }

    static step(message: string): void {

        if (!this.isEnabled()) return;

        console.log(
            `\n========== ${message} ==========\n`
        );
    }
}
