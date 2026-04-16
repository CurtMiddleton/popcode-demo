import OpenAI from "openai";
import type { ReservationType } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ParsedReservation {
  type: ReservationType;
  provider_name: string | null;
  confirmation_number: string | null;
  start_datetime: string | null; // ISO 8601
  end_datetime: string | null; // ISO 8601
  address: string | null;
  price: number | null;
  currency: string | null;

  // Type-specific (optional)
  flight_details?: {
    airline: string | null;
    flight_number: string | null;
    origin_airport: string | null;
    dest_airport: string | null;
    departure_time: string | null;
    arrival_time: string | null;
    terminal: string | null;
    gate: string | null;
    seat: string | null;
    booking_class: string | null;
  };
  hotel_details?: {
    hotel_name: string | null;
    address: string | null;
    check_in: string | null;
    check_out: string | null;
    room_type: string | null;
    phone: string | null;
    website: string | null;
  };
}

const SYSTEM_PROMPT = `You are a travel reservation parser. You will be given the text of a booking confirmation email. Extract the reservation details and return a JSON object.

Respond with a SINGLE JSON object (no markdown, no prose) matching this TypeScript shape:

{
  "type": "flight" | "hotel" | "restaurant" | "bar" | "activity" | "car_rental",
  "provider_name": string | null,           // Airline, hotel chain, restaurant, etc.
  "confirmation_number": string | null,     // Booking reference / confirmation code
  "start_datetime": string | null,          // ISO 8601 with timezone offset if known
  "end_datetime": string | null,            // ISO 8601 with timezone offset if known
  "address": string | null,                 // Full street address if present
  "price": number | null,                   // Numeric total (no currency symbol)
  "currency": string | null,                // 3-letter ISO code, e.g. "USD"
  "flight_details": {                       // ONLY include if type === "flight"
    "airline": string | null,
    "flight_number": string | null,         // e.g. "DL 42"
    "origin_airport": string | null,        // 3-letter IATA code, e.g. "JFK"
    "dest_airport": string | null,          // 3-letter IATA code, e.g. "CDG"
    "departure_time": string | null,        // ISO 8601
    "arrival_time": string | null,          // ISO 8601
    "terminal": string | null,
    "gate": string | null,
    "seat": string | null,
    "booking_class": string | null          // "Economy", "Business", etc.
  },
  "hotel_details": {                        // ONLY include if type === "hotel"
    "hotel_name": string | null,
    "address": string | null,
    "check_in": string | null,              // ISO 8601
    "check_out": string | null,             // ISO 8601
    "room_type": string | null,
    "phone": string | null,
    "website": string | null
  }
}

Rules:
- If a field is not clearly present in the email, set it to null. Do not guess.
- For flights: start_datetime = departure_time, end_datetime = arrival_time.
- For hotels: start_datetime = check_in, end_datetime = check_out.
- Preserve exact confirmation numbers, including dashes and mixed case.
- Return ONLY valid JSON. No code fences, no commentary.`;

/**
 * Parse a raw email body into structured reservation data using GPT-4o.
 * Returns null if parsing fails or the content doesn't look like a reservation.
 */
export async function parseEmailToReservation(
  subject: string,
  body: string
): Promise<ParsedReservation | null> {
  const userPrompt = `Subject: ${subject}\n\nEmail body:\n${body}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as ParsedReservation;

    // Minimal validation — must have a type we recognize
    const validTypes: ReservationType[] = [
      "flight",
      "hotel",
      "restaurant",
      "bar",
      "activity",
      "car_rental",
    ];
    if (!validTypes.includes(parsed.type)) {
      console.error("[parseEmail] Invalid type:", parsed.type);
      return null;
    }

    return parsed;
  } catch (err) {
    console.error("[parseEmail] OpenAI error:", err);
    return null;
  }
}
