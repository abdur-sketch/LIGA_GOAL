import { AsyncLocalStorage } from "node:async_hooks";
import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

export const rootDb = globalForPrisma.prisma ?? new PrismaClient();

/**
 * Execute existing DAL code against the transaction that established its RLS
 * context. This avoids threading a transaction client through hundreds of
 * service calls while still keeping SET LOCAL and every query on one socket.
 */
export function runWithDatabaseTransaction<T>(transaction: Prisma.TransactionClient, callback: () => Promise<T>) {
  return transactionStorage.run(transaction, callback);
}

export function activeDatabaseTransaction() {
  return transactionStorage.getStore();
}

export const db = new Proxy(rootDb, {
  get(target, property, receiver) {
    const transaction = transactionStorage.getStore();
    if (!transaction) {
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
    if (property === "$transaction") {
      return async (operation: unknown) => {
        if (typeof operation === "function") return operation(transaction);
        if (Array.isArray(operation)) return Promise.all(operation);
        throw new TypeError("Operasi transaksi Prisma tidak valid.");
      };
    }
    if (property === "$connect" || property === "$disconnect") {
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
    const value = Reflect.get(transaction, property, transaction);
    return typeof value === "function" ? value.bind(transaction) : value;
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = rootDb;
