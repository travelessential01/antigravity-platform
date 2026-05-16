import { Client } from "@elastic/elasticsearch";

const globalForElasticsearch = globalThis as typeof globalThis & {
  __stayassistElasticsearchClient?: Client;
};

export function getElasticsearchClient(): { client?: Client; error?: string } {
  const node = process.env.ELASTICSEARCH_URL?.trim();
  const username = process.env.ELASTICSEARCH_USERNAME?.trim();
  const password = process.env.ELASTICSEARCH_PASSWORD?.trim();

  if (!node || !username || !password) {
    return {
      error: "Elasticsearch forensic backend is not fully configured.",
    };
  }

  if (!globalForElasticsearch.__stayassistElasticsearchClient) {
    globalForElasticsearch.__stayassistElasticsearchClient = new Client({
      node,
      auth: { username, password },
    });
  }

  return { client: globalForElasticsearch.__stayassistElasticsearchClient };
}
