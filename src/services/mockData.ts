/**
 * Initial Seed Data for Demo & Testing
 * Features a realistic school route with school, driver depot, students and parent magic tokens
 * All entity IDs are valid UUIDs required by InstantDB.
 */

import { Alumno, Colegio, Conductor, Representante } from '../types';

export const INITIAL_SCHOOL_ID = 'e1000000-0000-4000-8000-000000000001';
export const SECOND_SCHOOL_ID = 'e1000000-0000-4000-8000-000000000002';

export const INITIAL_CONDUCTORES: Conductor[] = [
  {
    id: 'e7000000-0000-4000-8000-000000000001',
    nombre: 'Juan Carlos Guamán',
    telefono: '+593998765432',
    email: 'juancarlos.guaman@transporte.ec',
    licencia: 'Tipo E Profesional (N° 1709448123)',
    vehiculo_modelo: 'Toyota Coaster Escolar (Blanco/Amarillo)',
    vehiculo_placa: 'PBX-4521',
    capacidad_pasajeros: 18,
    activo: true,
    foto_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'e7000000-0000-4000-8000-000000000002',
    nombre: 'Maritza Villacís',
    telefono: '+593987654321',
    email: 'maritza.villacis@transporte.ec',
    licencia: 'Tipo D Profesional (N° 1712839450)',
    vehiculo_modelo: 'Mercedes-Benz Sprinter 516 (Gris Plata)',
    vehiculo_placa: 'PCZ-8910',
    capacidad_pasajeros: 16,
    activo: true,
    foto_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80'
  },
  {
    id: 'e7000000-0000-4000-8000-000000000003',
    nombre: 'Segundo Toapanta',
    telefono: '+593971239876',
    email: 'segundo.toapanta@transporte.ec',
    licencia: 'Tipo D Profesional (N° 1705629188)',
    vehiculo_modelo: 'Hyundai County Escolar (Amarillo Escolar)',
    vehiculo_placa: 'PAA-3322',
    capacidad_pasajeros: 20,
    activo: true,
    foto_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
  }
];

export const INITIAL_SCHOOL: Colegio = {
  id: INITIAL_SCHOOL_ID,
  nombre: 'Colegio San Gabriel',
  direccion: 'Av. América y Mariana de Jesús, Quito, Ecuador',
  lat: -0.1872,
  lng: -78.4975,
  hora_llegada_limite: '07:45:00',
  contacto_telefono: '+593 2 224 1500'
};

export const INITIAL_DRIVER_ORIGIN = {
  lat: -0.1980,
  lng: -78.4880,
  direccion: 'Base de Operaciones / Residencia Conductor (Sector La Pradera, Quito)'
};

export const INITIAL_REPRESENTANTES: Representante[] = [
  {
    id: 'e2000000-0000-4000-8000-000000000001',
    nombre: 'Carlos Mendoza',
    telefono_whatsapp: '+593991234501',
    magic_token: 'tok-carlos-mendoza-98a1',
    email: 'carlos.mendoza@ejemplo.com'
  },
  {
    id: 'e2000000-0000-4000-8000-000000000002',
    nombre: 'Mariana Silva',
    telefono_whatsapp: '+593984567802',
    magic_token: 'tok-mariana-silva-77b2',
    email: 'mariana.silva@ejemplo.com'
  },
  {
    id: 'e2000000-0000-4000-8000-000000000003',
    nombre: 'Roberto Gómez',
    telefono_whatsapp: '+593979876503',
    magic_token: 'tok-roberto-gomez-33c3',
    email: 'roberto.gomez@ejemplo.com'
  },
  {
    id: 'e2000000-0000-4000-8000-000000000004',
    nombre: 'Elena Rodríguez',
    telefono_whatsapp: '+593961122304',
    magic_token: 'tok-elena-rodriguez-44d4',
    email: 'elena.rodriguez@ejemplo.com'
  },
  {
    id: 'e2000000-0000-4000-8000-000000000005',
    nombre: 'Andrés Morales',
    telefono_whatsapp: '+593998877605',
    magic_token: 'tok-andres-morales-55e5',
    email: 'andres.morales@ejemplo.com'
  }
];

export const INITIAL_ALUMNOS: Alumno[] = [
  {
    id: 'e3000000-0000-4000-8000-000000000001',
    nombre: 'Mateo Mendoza',
    colegio_id: INITIAL_SCHOOL_ID,
    representante_id: 'e2000000-0000-4000-8000-000000000001',
    direccion_recogida: 'Av. González Suárez y San Ignacio, Edf. Panorama, Quito',
    lat: -0.2015,
    lng: -78.4770,
    grado: '4to Grado A',
    notas_medicas: 'Lentes permanentes. Esperar frente a la garita.',
    tiempo_abordaje_estimado_min: 2.5,
    modalidad_servicio: 'ida_y_vuelta',
    dias_ruta: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  },
  {
    id: 'e3000000-0000-4000-8000-000000000002',
    nombre: 'Camila Silva',
    colegio_id: INITIAL_SCHOOL_ID,
    representante_id: 'e2000000-0000-4000-8000-000000000002',
    direccion_recogida: 'Av. República del Salvador y Portugal, La Carolina, Quito',
    lat: -0.1810,
    lng: -78.4795,
    grado: '2do Grado B',
    notas_medicas: 'Alérgica al polvo. Salir con lonchera térmica.',
    tiempo_abordaje_estimado_min: 2.5,
    modalidad_servicio: 'ida_y_vuelta',
    dias_ruta: ['Lun', 'Mié', 'Vie']
  },
  {
    id: 'e3000000-0000-4000-8000-000000000003',
    nombre: 'Santiago Gómez',
    colegio_id: INITIAL_SCHOOL_ID,
    representante_id: 'e2000000-0000-4000-8000-000000000003',
    direccion_recogida: 'Av. Diego de Almagro y Av. Colón, La Mariscal, Quito',
    lat: -0.2045,
    lng: -78.4910,
    grado: '6to Grado C',
    notas_medicas: 'Lleva mochila con ruedas.',
    tiempo_abordaje_estimado_min: 2.0,
    modalidad_servicio: 'solo_ida',
    dias_ruta: ['Lun', 'Mar', 'Mié', 'Jue']
  },
  {
    id: 'e3000000-0000-4000-8000-000000000004',
    nombre: 'Valeria Rodríguez',
    colegio_id: INITIAL_SCHOOL_ID,
    representante_id: 'e2000000-0000-4000-8000-000000000004',
    direccion_recogida: 'Av. Eloy Alfaro y Los Granados, Sector El Batán, Quito',
    lat: -0.1650,
    lng: -78.4720,
    grado: '5to Grado A',
    notas_medicas: 'Acompañada de su abuela en la puerta.',
    tiempo_abordaje_estimado_min: 2.5,
    modalidad_servicio: 'solo_vuelta',
    dias_ruta: ['Mar', 'Jue']
  },
  {
    id: 'e3000000-0000-4000-8000-000000000005',
    nombre: 'Lucas Morales',
    colegio_id: INITIAL_SCHOOL_ID,
    representante_id: 'e2000000-0000-4000-8000-000000000005',
    direccion_recogida: 'Av. 6 de Diciembre y Gaspar de Villarroel, Quito',
    lat: -0.1670,
    lng: -78.4790,
    grado: '1er Grado A',
    notas_medicas: 'Asiento delantero o con cinturón ajustado.',
    tiempo_abordaje_estimado_min: 3.0,
    modalidad_servicio: 'ida_y_vuelta',
    dias_ruta: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  }
];
