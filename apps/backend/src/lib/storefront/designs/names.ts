/** A saved look's name as names are compared: trimmed, in Turkish lower case ("İstanbul" = "istanbul"). */
export const nameKey = (name: string): string => name.trim().toLocaleLowerCase("tr-TR")
