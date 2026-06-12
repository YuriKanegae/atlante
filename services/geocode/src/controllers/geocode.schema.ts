import { z } from "zod";

/** Validação dos parâmetros de query de `GET /geocode`. */
export const geocodeQuerySchema = z.object({
  q:     z.string().min(1, "informe um endereço").max(200),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export type GeocodeQueryInput = z.infer<typeof geocodeQuerySchema>;
