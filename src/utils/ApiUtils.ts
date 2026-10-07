import {
    APIRequestContext,
    request
} from '@playwright/test';

export class ApiUtils {

    private apiContext!: APIRequestContext;

    async initialize(
        baseUrl: string
    ): Promise<void> {

        this.apiContext =
            await request.newContext({

                baseURL: baseUrl,

                extraHTTPHeaders: {
                    'Content-Type': 'application/json'
                }
            });
    }

    async get(
        endpoint: string
    ) {

        return await this.apiContext.get(
            endpoint
        );
    }

    async post(
        endpoint: string,
        payload: unknown
    ) {

        return await this.apiContext.post(
            endpoint,
            {
                data: payload
            }
        );
    }

    async put(
        endpoint: string,
        payload: unknown
    ) {

        return await this.apiContext.put(
            endpoint,
            {
                data: payload
            }
        );
    }

    async delete(
        endpoint: string
    ) {

        return await this.apiContext.delete(
            endpoint
        );
    }

    async dispose(): Promise<void> {

        await this.apiContext.dispose();
    }
}