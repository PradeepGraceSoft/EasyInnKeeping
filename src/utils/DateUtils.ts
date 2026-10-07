export class DateUtils {

    private static getDate(daysToAdd = 0): Date {
        const date = new Date();
        date.setDate(date.getDate() + daysToAdd);
        return date;
    }

    static addDaysMMDDYYYY(daysToAdd = 0): string {
        const date = this.getDate(daysToAdd);

        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = date.getFullYear();

        return `${mm}/${dd}/${yyyy}`;
    }

    static addDaysMdYYYY(daysToAdd = 0): string {
        const date = this.getDate(daysToAdd);

        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    }

    static addDaysYYYYMMDD(daysToAdd = 0): string {
        const date = this.getDate(daysToAdd);

        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${date.getFullYear()}-${mm}-${dd}`;
    }

    static formatDateToLong(dateInput: string): string {
        const date = new Date(dateInput);

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static convertMMDDYYYYToLong(inputDate: string): string {

        const [month, day, year] = inputDate.split('/');

        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day)
        );

        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    static getMonthYearDay(inputDate: string): {
        year: string;
        month: string;
        day: string;
    } {

        const date = new Date(inputDate);

        return {
            year: date.getFullYear().toString(),
            month: date.toLocaleString('en-US', {
                month: 'short'
            }).toUpperCase(),
            day: String(date.getDate()).padStart(2, '0')
        };
    }

    static getCurrentTimestamp(): string {

        const now = new Date();

        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');

        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');

        return `${yyyy}${mm}${dd}_${hh}${min}${sec}`;
    }

    static getToday(): string {
        return this.addDaysMMDDYYYY(0);
    }

    static getTomorrow(): string {
        return this.addDaysMMDDYYYY(1);
    }

    static getYesterday(): string {
        return this.addDaysMMDDYYYY(-1);
    }
}