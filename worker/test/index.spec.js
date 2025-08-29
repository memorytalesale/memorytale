import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

describe('Tale Chatbot Worker', () => {
	it('responds with CORS headers for OPTIONS request', async () => {
		const request = new Request('http://example.com', { method: 'OPTIONS' });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(204);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
	});

	it('responds with 405 for unsupported methods', async () => {
		const request = new Request('http://example.com', { method: 'DELETE' });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(405);
		const jsonResponse = await response.json();
		expect(jsonResponse.error).toBe('Method not allowed');
	});

	it('responds with error for POST without body', async () => {
		const request = new Request('http://example.com', { 
			method: 'POST',
			headers: { 'Content-Type': 'application/json' }
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		
		expect(response.status).toBe(400);
		const jsonResponse = await response.json();
		expect(jsonResponse.error).toBeDefined();
	});
});
