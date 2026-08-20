/**
 * Initial Seed Data for Demo & Testing
 * Features a realistic school route with school, driver depot, students and parent magic tokens
 */

import { Alumno, Colegio, Representante } from '../types';

export const INITIAL_SCHOOL: Colegio = {
  id: 'col_01',
  nombre: 'Colegio San Ignacio de Loyola',
  direccion: 'Av. Santa Teresa de Jesús, La Castellana, Caracas',
  lat: 10.4995,
  lng: -66.8525,
  hora_llegada_limite: '08:00:00',
  contacto_telefono: '+58 212 263 4511'
};

export const INITIAL_DRIVER_ORIGIN = {
  lat: 10.4720,
  lng: -66.8830,
  direccion: 'Estacionamiento Base / Residencia Conductor (Los Chaguaramos)'
};

export const INITIAL_REPRESENTANTES: Representante[] = [
  {
    id: 'rep_01',
    nombre: 'Carlos Mendoza',
    telefono_whatsapp: '+584121234501',
    magic_token: 'tok-carlos-mendoza-98a1',
    email: 'carlos.mendoza@ejemplo.com'
  },
  {
    id: 'rep_02',
    nombre: 'Mariana Silva',
    telefono_whatsapp: '+584149876502',
    magic_token: 'tok-mariana-silva-77b2',
    email: 'mariana.silva@ejemplo.com'
  },
  {
    id: 'rep_03',
    nombre: 'Roberto Gómez',
    telefono_whatsapp: '+584245551203',
    magic_token: 'tok-roberto-gomez-33c3',
    email: 'roberto.gomez@ejemplo.com'
  },
  {
    id: 'rep_04',
    nombre: 'Elena Rodríguez',
    telefono_whatsapp: '+584128889904',
    magic_token: 'tok-elena-rodriguez-44d4',
    email: 'elena.rodriguez@ejemplo.com'
  },
  {
    id: 'rep_05',
    nombre: 'Andrés Morales',
    telefono_whatsapp: '+584167773305',
    magic_token: 'tok-andres-morales-55e5',
    email: 'andres.morales@ejemplo.com'
  }
];

export const INITIAL_ALUMNOS: Alumno[] = [
  {
    id: 'alu_01',
    nombre: 'Mateo Mendoza',
    colegio_id: 'col_01',
    representante_id: 'rep_01',
    direccion_recogida: 'Calle Los Cedros, Edf. Rosalba, Apto 4B, Sabana Grande',
    lat: 10.4905,
    lng: -66.8770,
    grado: '4to Grado A',
    notas_medicas: 'Lentes permanentes. Esperar frente a la garita.',
    tiempo_abordaje_estimado_min: 2.5
  },
  {
    id: 'alu_02',
    nombre: 'Camila Silva',
    colegio_id: 'col_01',
    representante_id: 'rep_02',
    direccion_recogida: 'Av. Francisco de Miranda con Av. Ávila, Altamira Sur',
    lat: 10.4940,
    lng: -66.8620,
    grado: '2do Grado B',
    notas_medicas: 'Alérgica al polvo. Salir con lonchera térmica.',
    tiempo_abordaje_estimado_min: 2.5
  },
  {
    id: 'alu_03',
    nombre: 'Santiago Gómez',
    colegio_id: 'col_01',
    representante_id: 'rep_03',
    direccion_recogida: 'Av. Libertador, Torre Maracaibo, Chacao',
    lat: 10.4890,
    lng: -66.8690,
    grado: '6to Grado C',
    notas_medicas: 'Lleva mochila con ruedas.',
    tiempo_abordaje_estimado_min: 2.0
  },
  {
    id: 'alu_04',
    nombre: 'Valeria Rodríguez',
    colegio_id: 'col_01',
    representante_id: 'rep_04',
    direccion_recogida: '4ta Transversal con 2da Avenida, Los Palos Grandes',
    lat: 10.4970,
    lng: -66.8480,
    grado: '5to Grado A',
    notas_medicas: 'Acompañada de su abuela en la puerta.',
    tiempo_abordaje_estimado_min: 2.5
  },
  {
    id: 'alu_05',
    nombre: 'Lucas Morales',
    colegio_id: 'col_01',
    representante_id: 'rep_05',
    direccion_recogida: 'Calle Mohedano, Residencia Avila Real, Chacao',
    lat: 10.4930,
    lng: -66.8560,
    grado: '1er Grado A',
    notas_medicas: 'Asiento delantero o con cinturón ajustado.',
    tiempo_abordaje_estimado_min: 3.0
  }
];
