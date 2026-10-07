export class RandomDataUtils {

    static randomNumber(min = 1000, max = 9999): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static randomString(length = 8): string {

        const chars =
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

        let result = '';

        for (let i = 0; i < length; i++) {
            result += chars.charAt(
                Math.floor(Math.random() * chars.length)
            );
        }

        return result;
    }

    static randomEmail(): string {
        const uniqueId = Math.random().toString(36).slice(2, 8);

        return `tester1gracesoft-${Date.now()}-${uniqueId}@gmail.com`;
    }

    static randomPhoneNumber(): string {

        return `9${Math.floor(
            100000000 + Math.random() * 900000000
        )}`;
    }

    static randomGuestName(): string {

        return `Guest_${this.randomString(6)}`;
    }

    static randomCompanyName(): string {

        return `Company_${this.randomString(5)}`;
    }

    static randomReservationNumber(): string {

        return `${Date.now()}`;
    }
}
