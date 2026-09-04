const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../data/db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const directory = [
    { publicId: 1, name: "Orlando Creus", email: "ocreus@atg-rappido.com", status: "Activo", phone: "+50763198199" },
    { publicId: 3, name: "Astrid Mariscal", email: "amariscal@atg-rappido.com", status: "Activo", phone: "+5076120-9824" },
    { publicId: 4, name: "Anayaris Vásquez", email: "avasquez@atg-rappido.com", status: "Activo", phone: "+5076319-8697" },
    { publicId: 5, name: "Roberto Remis", email: "rremis@atg-rappido.com", status: "Activo", phone: "+5076201-4119" },
    { publicId: 8, name: "Daniel Opua", email: "t.solutiond.o@gmail.com", status: "Activo", phone: "+5076856-1285" },
    { publicId: 9, name: "Jonathan Castillo", email: "jcastillo@atg-rappido.com", status: "Inactivo", phone: "+5076037-6159" },
    { publicId: 10, name: "EDGAR ABDIEL", email: "eramirez@atg-rappido.com", status: "Inactivo", phone: "6866-6131" },
    { publicId: 14, name: "Mingthoys Ramos Dominguez", email: "mramos@atg-rappido.com", status: "Inactivo", phone: "+50768553365" },
    { publicId: 17, name: "Mario Gonzalez", email: "galexandra.aig@gmail.com", status: "Activo", phone: "" },
    { publicId: 18, name: "Ricardo Barria", email: "rbarria@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 19, name: "Tablet Proyecto 1", email: "proyectos@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 20, name: "AREMAR", email: "pagosdirecto.01@gmail.com", status: "Activo", phone: "" },
    { publicId: 21, name: "Virtual Phone", email: "stevennetflix2020@gmail.com", status: "Inactivo", phone: "65050890" },
    { publicId: 22, name: "Maydelin Mixelis Barria Ojo", email: "mbarria@atg-rappido.com", status: "Activo", phone: "6319-8697" },
    { publicId: 26, name: "Boniblac", email: "boniblanc02@gmail.com", status: "Activo", phone: "" },
    { publicId: 27, name: "Jose Mendoza", email: "jpfibersolutions@gmail.com", status: "Activo", phone: "" },
    { publicId: 28, name: "Cobros Agua Fria", email: "panamavirtual.phone@gmail.com", status: "Inactivo", phone: "" },
    { publicId: 29, name: "Luis David", email: "ldavid@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 32, name: "Nehemias Canto", email: "nehemias@atg-rappido.com", status: "Activo", phone: "+50768982262" },
    { publicId: 34, name: "Yeisca Espada", email: "yeiscaespada@gmail.com", status: "Activo", phone: "" },
    { publicId: null, name: "Katheine Williams", email: "professionalservicesw@gmail.com", status: "Activo", phone: "" },
    { publicId: 36, name: "Gerardo Mejivar", email: "gerardo.menjivar@gmail.com", status: "Activo", phone: "" },
    { publicId: 37, name: "Yakelin Espinoza", email: "yespinoza@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 38, name: "Alicia Marin", email: "amarin@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 39, name: "Manuel Perez", email: "mperez@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 40, name: "Nayelis Mariscal", email: "nemariscal@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 41, name: "Derian Morales", email: "dmorales@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 42, name: "Juan Carlos Atencio", email: "juancatencio@gmail.com", status: "Inactivo", phone: "" },
    { publicId: 43, name: "Capacitaciones ATG", email: "capacitaciones@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 44, name: "Abraham Quintero", email: "aquintero@atg-rappido.com", status: "Inactivo", phone: "68181891" },
    { publicId: 45, name: "Yarisbel Reina", email: "yreina@atg-rappido.com", status: "Activo", phone: "65684979" },
    { publicId: 46, name: "Mariolys Remis", email: "mremis@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 47, name: "Caira Rubio", email: "crubio@atg-rappido.com", status: "Inactivo", phone: "6397-9245" },
    { publicId: 48, name: "Edwar Vasquez", email: "evasquez@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 49, name: "Nelson Eduar Sagel", email: "nsagel@atg-rappido.com", status: "Activo", phone: "" },
    { publicId: 50, name: "colombiatel", email: "infraestructuracolombiatel@gmail.com", status: "Activo", phone: "+57 350 8108102" },
    { publicId: 51, name: "Vanessa Canate", email: "vaneindira27@gmail.com", status: "Activo", phone: "" },
    { publicId: 52, name: "Regie Spencer", email: "rspencer@atg-rappido.com", status: "Inactivo", phone: "" },
    { publicId: 53, name: "Aaliyah Espada", email: "aespada@atg-rappido.com", status: "Activo", phone: "" }
];

const clean = (s) => String(s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function findMatch(name) {
    const cleanTarget = clean(name);
    let match = directory.find(e => clean(e.name) === cleanTarget);
    if (match) return match;
    match = directory.find(e => {
        const cName = clean(e.name);
        return (cName.length > 3 && cleanTarget.includes(cName)) || (cleanTarget.length > 3 && cName.includes(cleanTarget));
    });
    return match;
}

let updated = 0;
['supervisors', 'technicians'].forEach(key => {
    (db[key] || []).forEach(u => {
        const match = findMatch(u.name);
        if (match) {
            console.log(`[${key}] Actualizando "${u.name}": ${u.email} -> ${match.email} | Tel: ${match.phone || '--'}`);
            u.email = match.email;
            if (match.phone && !u.phone) u.phone = match.phone;
            if (match.status === 'Inactivo') u.disabled = true;
            updated++;
        }
    });
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`\n¡Listo! ${updated} cuentas actualizadas con correos y teléfonos oficiales.`);
