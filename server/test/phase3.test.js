import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGeminiService } from '../services/geminiService.js';
import { fetchNearbyFacilities } from '../services/nearbyResources.js';

describe('Phase 3 service behavior', () => {
  it('uses the Gemini server client with retrieved context and no saved conversation', async () => {
    let requestBody;
    const service = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async (url, options) => {
        assert.match(String(url), /models\/test-model:generateContent/);
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Use the cited guidance [1].' }] } }] }),
        };
      },
    });

    const answer = await service.generate({
      query: 'How do I request help?',
      documents: [{ title: 'SOS guide', content: 'Use the ResQ SOS screen.' }],
    });

    assert.equal(answer, 'Use the cited guidance [1].');
    assert.match(requestBody.systemInstruction.parts[0].text, /untrusted data/);
    assert.match(requestBody.contents[0].parts[0].text, /SOS guide/);
    assert.match(requestBody.contents[0].parts[0].text, /How do I request help/);
    assert.doesNotMatch(JSON.stringify(requestBody), /conversation history|private account data/i);
  });

  it('allows ordinary chat without retrieved references while restricting safety guidance', async () => {
    let requestBody;
    const service = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Saturn has an extensive ring system.' }] } }] }),
        };
      },
    });

    const answer = await service.generate({ query: 'Tell me a fun fact about Saturn.', documents: [] });
    const prompt = requestBody.systemInstruction.parts[0].text;
    const userContent = requestBody.contents[0].parts[0].text;

    assert.equal(answer, 'Saturn has an extensive ring system.');
    assert.match(prompt, /ordinary non-safety conversation/);
    assert.match(prompt, /ground procedural claims only in supplied reference excerpts/);
    assert.match(userContent, /No relevant reference excerpts were found/);
  });

  it('does not call Gemini without a configured key and reports provider failure', async () => {
    let called = false;
    const unconfigured = createGeminiService({
      apiKey: '',
      model: 'test-model',
      fetchImpl: async () => { called = true; },
    });
    assert.equal(await unconfigured.generate({ query: 'question', documents: [] }), null);
    assert.equal(called, false);

    const unavailable = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async () => ({ ok: false }),
    });
    await assert.rejects(
      unavailable.generate({ query: 'question', documents: [] }),
      (error) => error.code === 'HTTP_ERROR',
    );

    const quotaExceeded = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async () => ({ ok: false, status: 429 }),
    });
    await assert.rejects(
      quotaExceeded.generate({ query: 'question', documents: [] }),
      (error) => error.code === 'QUOTA',
    );

    const timedOut = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); },
    });
    await assert.rejects(
      timedOut.generate({ query: 'question', documents: [] }),
      (error) => error.code === 'TIMEOUT',
    );
  });

  it('sends only structured stress answers to Gemini and accepts only a broad supported level', async () => {
    let requestBody;
    const service = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ candidates: [{ content: { parts: [{ text: '{"level":"moderate"}' }] } }] }),
        };
      },
    });

    const answers = { scared: 2, confused: 1, overwhelmed: 0, focus: 2, tense: 1 };
    assert.deepEqual(await service.assessStress({ answers }), { level: 'moderate' });
    assert.match(requestBody.systemInstruction.parts[0].text, /non-clinical/);
    assert.match(requestBody.systemInstruction.parts[0].text, /not a diagnosis/);
    assert.match(requestBody.contents[0].parts[0].text, /Feeling scared: Yes/);
    assert.match(requestBody.contents[0].parts[0].text, /Able to focus: Yes/);
    assert.equal(requestBody.generationConfig.responseMimeType, 'application/json');
    assert.doesNotMatch(JSON.stringify(requestBody), /account|history|email|name/i);

    const invalid = createGeminiService({
      apiKey: 'test-key',
      model: 'test-model',
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: '{"level":"critical"}' }] } }] }),
      }),
    });
    await assert.rejects(
      invalid.assessStress({ answers }),
      (error) => error.code === 'INVALID_RESPONSE',
    );
  });

  it('returns sorted and bounded OpenStreetMap results without requiring network access', async () => {
    let requestBody;
    const facilities = await fetchNearbyFacilities({
      lat: 28.67,
      lng: 77.45,
      radiusKm: 5,
      endpoint: 'https://overpass.test/interpreter',
      fetchImpl: async (_url, options) => {
        requestBody = options.body;
        return {
          ok: true,
          json: async () => ({
            elements: [
              { type: 'node', id: 2, lat: 28.671, lon: 77.451, tags: { amenity: 'clinic', name: 'Nearby Clinic' } },
              { type: 'way', id: 1, center: { lat: 28.672, lon: 77.452 }, tags: { amenity: 'hospital', name: 'Nearby Hospital' } },
              { type: 'node', id: 3, lat: 28.67, lon: 78, tags: { amenity: 'hospital', name: 'Outside Radius' } },
              { type: 'node', id: 4, lat: 28.67, lon: 77.45, tags: { amenity: 'school', name: 'Not a facility' } },
            ],
          }),
        };
      },
    });

    assert.match(requestBody.get('data'), /around:5000,28\.67,77\.45/);
    assert.equal(facilities.length, 2);
    assert.equal(facilities[0].name, 'Nearby Clinic');
    assert.ok(facilities[0].distanceKm < facilities[1].distanceKm);
    assert.equal(facilities[0].source, 'OpenStreetMap');
    assert.equal(facilities.some(({ name }) => name === 'Outside Radius'), false);
  });

});
