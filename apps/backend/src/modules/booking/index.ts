import { Module } from "@medusajs/framework/utils"
import BookingModuleService from "./service"

/** Dated products: departures, their places, carts' holds and bookings (adr/0076 §3). */
export const BOOKING_MODULE = "booking"

export default Module(BOOKING_MODULE, { service: BookingModuleService })
