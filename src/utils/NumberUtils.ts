export class NumberUtils {

    static formatDecimal(value: number): string {
        return value.toFixed(2);
    }

    static formatInteger(value: number): string {
        return Math.round(value).toString();
    }

    static removeCurrencyFormatting(value: string): string {
        return value
            .replace('$', '')
            .replace(',', '')
            .trim();
    }

    static parseCurrency(value: string): number {
        return Number(
            this.removeCurrencyFormatting(value)
        );
    }

    static roundToTwoDecimals(value: number): number {
        return Number(value.toFixed(2));
    }

    static percentage(value: number, total: number): number {

        if (total === 0) {
            return 0;
        }

        return Number(
            ((value / total) * 100).toFixed(2)
        );
    }

    static randomNumber(min: number, max: number): number {

        return Math.floor(
            Math.random() * (max - min + 1)
        ) + min;
    }

    static isZero(value: number): boolean {
        return value === 0;
    }
}