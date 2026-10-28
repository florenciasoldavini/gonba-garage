/** Explicit display policy for MLA1744 (Autos y Camionetas), reviewed 2026-10-28.
 * Source: https://api.mercadolibre.com/categories/MLA1744/attributes
 * Includes separately identified legacy IDs observed in Gonba publications.
 * Provider hidden/read_only tags are not display decisions for this website.
 */
export type VehicleAttributeSection = 'general' | 'mechanics' | 'safety' | 'comfort' | 'dimensions';

export type AttributeExclusionReason = 'internal_metadata' | 'identifiers' | 'unconfirmed_warranty'
  | 'regional_metadata' | 'history_disabled' | 'commercial_terms' | 'not_vehicle_specification';

export type VehicleAttributeRule =
  | { readonly action: 'show'; readonly section: VehicleAttributeSection }
  | { readonly action: 'exclude'; readonly reason: AttributeExclusionReason };

export const VEHICLE_ATTRIBUTE_SECTIONS = [
  { id: 'mechanics', title: 'Motor y mecánica' },
  { id: 'safety', title: 'Seguridad' },
  { id: 'comfort', title: 'Confort y equipamiento' },
  { id: 'dimensions', title: 'Dimensiones y capacidades' },
] as const;

export const VEHICLE_ATTRIBUTE_POLICY_GROUPS = [
  {
    rule: { action: 'show', section: 'general' },
    ids: [
      'BRAND', // Marca
      'MODEL', // Modelo
      'VEHICLE_YEAR', // Año
      'KILOMETERS', // Kilómetros
      'ITEM_CONDITION', // Condición del ítem
      'SINGLE_OWNER', // Único dueño
      'VEHICLE_BODY_TYPE', // Tipo de carrocería
      'DOORS', // Puertas
      'ENGINE', // Motor
      'FUEL_TYPE', // Tipo de combustible
      'TRANSMISSION', // Transmisión
      'TRACTION_CONTROL', // Control de tracción
      'COLOR', // Color
      'TRIM', // Versión
      'SHORT_VERSION', // Versiones
      'LINE', // Línea
      'DETAILED_MODEL', // Modelo detallado
      'MANUFACTURING_YEAR', // Año de fabricación
    ],
  },
  {
    rule: { action: 'show', section: 'mechanics' },
    ids: [
      'BATTERY_TYPE', // Tipo de batería
      'BATTERY_CAPACITY', // Capacidad de la batería
      'CHARGE_TIME', // Tiempo de carga
      'CHARGER_TYPE', // Tipo de cargador
      'CARS_BATTERY_AUTONOMY', // Autonomia de la batería
      'STEERING', // Dirección
      'ENGINE_DISPLACEMENT', // Cilindrada
      'GEAR_NUMBER', // Numero de velocidades
      'POWER', // Potencia
      'TRANSMISSION_DETAIL', // Detalle transmisión
      'CYLINDERS', // Cilindros
      'VALVES_PER_CYLINDER', // Válvulas por cilindro
      'ACCELERATION', // Aceleración
      'ACCELERATION_GASOLINE', // Aceleración nafta
      'ACCELERATION_ALCOHOL', // Aceleración alcohol
      'ACCELERATION_DIESEL', // Aceleración diesel
      'AVERAGE_FUEL_ECONOMY', // Consumo promedio combustible
      'AVERAGE_FUEL_ENCONOMY_GASOLINE', // Consumo promedio nafta
      'AVERAGE_FUEL_ENCONOMY_ALCOHOL', // Consumo promedio alcohol
      'AVERAGE_FUEL_ENCONOMY_DIESEL', // Consumo promedio diesel
      'AUTONOMY', // Autonomía
      'AUTONOMY_GASOLINE', // Autonomía con nafta
      'AUTONOMY_ALCOHOL', // Autonomía con alcohol
      'AUTONOMY_DIESEL', // Autonomía con diesel
      'MAXIMUM_VELOCITY', // Velocidad máxima
      'MAXIMUM_VELOCITY_GASOLINE', // Velocidad máxima con nafta
      'MAXIMUM_VELOCITY_ALCOHOL', // Velocidad máxima con alcohol
      'MAXIMUM_VELOCITY_DIESEL', // Velocidad máxima con diesel
      'ROUTE_AVERAGE_CONSUMPTION', // Consumo medio en ruta
      'CITY_AVERAGE_CONSUMPTION', // Consumo medio en ciudad
      'WITH_GEARS_CHANGE_IN_STEERING_WHEEL', // Con cambio de marchas en el volante
      'WITH_ECO_MODE', // Con modo Eco
      'WITH_ENGINE_WITH_EMISSION_REDUCTION_TECHNOLOGY', // Con motor con tecnología de reducción de emisiones (Efficiency)
      'BRAKES', // Frenos
      'TORQUE', // Legacy adapter ID
    ],
  },
  {
    rule: { action: 'show', section: 'safety' },
    ids: [
      'WITH_OFF_ROAD_LIGHTS', // Con luces exploradoras
      'ARMORED', // Blindado
      'WITH_SAFETY_FILMS', // Con films de seguridad
      'HAS_ABS_BRAKES', // Frenos ABS
      'HAS_ALARM', // Alarma
      'HAS_DRIVER_AIRBAG', // Airbag conductor
      'HAS_ELECTRONIC_BRAKE_ASSIST', // Repartidor electrónico de fuerza de frenado
      'HAS_ENGINE_INMOVILIZER', // Sistema de bloqueo de encendido
      'HAS_FOG_LIGHT', // Faros antiniebla
      'HAS_FRONT_FOGLIGHTS', // Faros antinieblas delanteros
      'HAS_HEADLIGHT_CONTROL', // Faros con regulación automática
      'HAS_HEADREST_REAR_SEAT', // Apoya cabeza en asientos traseros
      'HAS_LIGHT_ON_REMINDER', // Alarma de luces encendidas
      'HAS_LIGHT_SENSOR', // Sensor de luz
      'HAS_PARKING_SENSOR', // Sensor de estacionamiento
      'HAS_PASSENGER_AIRBAG', // Airbag para conductor y pasajero
      'HAS_RAIN_SENSOR', // Sensor de lluvia
      'HAS_REAR_FOGLIGHTS', // Faros antinieblas traseros
      'HAS_REAR_WINDOW_DEFOGGER', // Desempañador trasero
      'HAS_ROLL_BAR', // Barra anti vuelco
      'HAS_SIDE_IMPACT_AIRBAG', // Airbag laterales
      'HAS_STABILITY_CONTROL', // Control de estabilidad
      'HAS_THIRD_STOP', // Tercera luz de freno led
      'HAS_WINDSCREEN_WIPER', // Limpia/lava luneta
      'HAS_XENON_HEADLIGHTS', // Faros de xenón
      'HAS_CURTAIN_AIRBAG', // Airbag de cortina
      'WITH_BACKUP_CAMERA', // Con cámara de retroceso
      'HAS_SIDE_IMPACT_FRONT_AIRBAG', // Airbag laterales delanteros
      'HAS_SIDE_IMPACT_REAR_AIRBAG', // Airbag laterales traseros
      'HAS_ISOFIX', // Sistema ISOFIX
      'HAS_ASR_TRACTION', // Tracción ASR
      'HAS_FRONT_PARKING_SENSOR', // Sensor delantero de distancia para estacionamiento
      'HAS_REAR_PARKING_SENSOR', // Sensor trasero de distancia para estacionamiento
      'HAS_BLIND_SIDE_ZONE_ALERT', // Aviso de punto ciego
      'WITH_LED_FOGLIGHTS', // Con faros de neblina LED
      'WITH_AUXILIARY_LIGHTS_ACTIVATION_IN_CASE_OF_SUDDEN_STOP', // Con accionamiento de luces auxiliares en caso de frenado brusco
      'WITH_RETRACTABLE_FRONT_SEAT_BELTS', // Con cinturones de seguridad delanteros retráctiles
      'WITH_RETRACTABLE_FRONT_SEAT_BELTS_WITH_ELECTRIC_ADJUSTMENT', // Con cinturones de seguridad delanteros retráctiles con regulación eléctrica de altura
      'WITH_RETRACTABLE_FRONT_SEAT_BELTS_WITH_HEIGHT_ADJUSTMENT', // Con cinturones de seguridad delanteros retráctiles con regulación de altura
      'WITH_RETRACTABLE_REAR_SEAT_BELTS', // Con cinturones de seguridad traseros retráctiles
      'WITH_RETRACTABLE_REAR_SEAT_BELTS_WITH_ELECTRIC_ADJUSTMENT', // Con cinturones de seguridad traseros retráctiles con regulación eléctrica de altura
      'WITH_RETRACTABLE_REAR_SEAT_BELTS_WITH_HEIGHT_ADJUSTMENT', // Con cinturones de seguridad traseros retráctiles con regulación de altura
      'WITH_AUTOMATIC_UNLOCK_DOORS_IN_ACCIDENT', // Con destrabamiento automático de puertas en caso de accidente
      'WITH_CORNERING_BRAKE_CONTROL_SYSTEM_CBC', // Con sistema de control de frenado en curva (CBC)
      'WITH_HEADLIGHTS_WITH_AUTOMATIC_ACTIVATION', // Con faros con accionamiento automático-encendido
      'WITH_LANE_CHANGING_SENSOR', // Con sensor de cambio de carril
      'WITH_ACTIVE_LANE_CHANGING_SENSOR', // Con sensor de cambio de carril activo
      'WITH_PARKING_SENSOR_BY_FRONT_CAMERA', // Con sensor de estacionamiento por cámara delantera
      'WITH_PARKING_SENSOR_BY_REAR_CAMERA', // Con sensor de estacionamiento por cámara trasera
      'WITH_AUTOMATIC_PARKING_SENSOR', // Con sistema de estacionamiento automático
      'WITH_PARKING_SENSOR_WITH_GRAPHICS', // Con sistema de estacionamiento con gráficos
      'WITH_LED_HEADLIGHTS', // Con faros delanteros LED
      'WITH_DAYTIME_LED_LIGHTS', // Con faros diurnos LED
      'WITH_LED_REAR_LIGHTS', // Con faros traseros LED
      'WITH_HEADLIGHT_WASHER', // Con lavador de faros
      'WITH_HEADLIGHT_CLEANER', // Con limpiador de faros
      'WITH_HEADLIGHTS_IGNITION_WHEN_RAIN', // Con faros con encendido en caso de lluvia
    ],
  },
  {
    rule: { action: 'show', section: 'dimensions' },
    ids: [
      'PASSENGER_CAPACITY', // Capacidad de personas
      'LENGTH', // Largo
      'HEIGHT', // Altura
      'WIDTH', // Ancho
      'DISTANCE_BETWEEN_AXES', // Distancia entre ejes
      'LUGGAGE_CAPACITY', // Baúl
      'FUEL_CAPACITY', // Capacidad del tanque
      'WEIGHT', // Legacy adapter ID
      'TRUNK_CAPACITY', // Legacy adapter ID
    ],
  },
  {
    rule: { action: 'exclude', reason: 'history_disabled' },
    ids: [
      'REPUVE_REGISTRATION', // Inscripción en REPUVE
      'AMDA_SECURITY_PAPER_INVOICE', // Factura en papel seguridad AMDA
      'US_CANADA_CIRCULATION_ALERT', // Alerta de circulación en EE.UU. o canadá
      'NORTH_AMERICA_CIRCULATION_RECORD', // Registro de circulación en norteamérica
      'HAS_TOTAL_LOSS', // Pérdida total
      'WITH_TECHNOMECHANICAL_REVIEW', // Con revisión tecnomecánica
      'IS_INSURED_VEHICLE', // Vehículo asegurado
      'WITH_PAID_IPVA', // Con IPVA pago
      'HAS_VEHICLE_INSPECTION', // Inspección vehicular
      'THEFT_REPORTS_NUMBER', // Cantidad de denuncias de robo
      'REMARKED_CHASSIS_NUMBER', // Cantidad de chasis remarcado
      'USED_AS_POLICE_CAR_NUMBER', // Cantidad de veces utilizado como vehículo policial
      'SUFFERED_DAMAGE_NUMBER', // Cantidad de daños sufridos
      'SCHEDULED_FOR_SCRAPPING_NUMBER', // Cantidad de veces que fue desmantelado
      'INSURANCE_DEREGISTRATION_NUMBER', // Fue dado de baja por la aseguradora
      'PENDING_FINES_NUMBER', // Cantidad de multas pendientes
      'OWNERS_NUMBER', // Cantidad de dueños
      'PRIOR_AUCTIONS_NUMBER', // Número de subastas anteriores
      'LEGALIZED_INTERNATIONAL_ENTRY', // Entrada internacional legalizada
      'ENGINE_CONDITION', // Estado del motor
      'BODYWORK_CONDITION', // Estado de la carrocería
      'BRAKES_CONDITION', // Estado de los frenos
      'TIRES_CONDITION', // Estado de los neumáticos
      'CABIN_CONDITION', // Estado de la cabina
      'WITH_VERIFICATION_REPORT', // Con verificación vehicular
      'VEHICLE_INSPECTION_STATUS', // Estado de la inspección mecánica
      'VEHICLE_INSPECTION_DATE', // Fecha de la inspección mecánica
      'VEHICLE_INSPECTION_PROVIDER_NAME', // Nombre del proveedor de la inspección mecánica
      'HAS_HISTORIC_INFORMATION', // Histórico vehicular
      'HISTORIC_INFORMATION_DATE', // Fecha de información histórica
    ],
  },
  {
    rule: { action: 'exclude', reason: 'commercial_terms' },
    ids: [
      'CONTACT_SCHEDULE', // Horario de contacto
      'WITH_NEGOTIABLE_PRICE', // Con precio negociable
      'SALE_WITH_EXCHANGE', // Acepta permuta
      'CAR_DELIVERY', // Entrega a domicilio
      'VIRTUAL_TOURS', // Tours virtuales
      'HOME_TEST_DRIVE', // Test drive a domicilio
      'SANITIZATION_POLICY', // Sanitiza el vehículo
      'PAPERWORK_FROM_HOME', // Documentación en casa
      'PRICE_INCLUDES_SHIPPING_AND_DOCUMENTATION', // Precio incluye flete y formularios
    ],
  },
  {
    rule: { action: 'exclude', reason: 'internal_metadata' },
    ids: [
      'MARKET', // Mercado
      'APGID', // APGID
      'PRESALE_END_DATE', // Fecha término de preventa
      'PREVIOUS_PRICE', // Precio anterior
      'IS_OFFERED_BY_BRAND', // Es ofrecido por la marca
      'CMG_SITE', // Sitio de origen
      'SELLER_CATALOG_VERSION_ID', // Id catálogo vendedor
      'VEHICLE_GALLERY_INTERIOR', // Diseño interior
      'VEHICLE_GALLERY_EXTERIOR', // Diseño exterior
      'BRAND_BENEFITS', // Beneficios de la marca
      'CAROUSEL_BULLETS', // Viñetas carrusel
      'HIGHLIGHT_TEXT', // Texto destacado
      'SPECS_FILE_URL', // Archivo pdf
      'VEHICLE_LOGO_ID', // Logo vehiculo
      'VEHICLE_RISK_PROFILE_IDENTIFIER', // Identificador del perfil de riesgo del vehículo
      'HAS_LEADS_PENALIZATION', // Tiene penalización por Leads
      'VEHICLE_INSPECTION_ID', // Identificador de la inspección mecánica
      'HAS_GOOD_QUALITY', // Tiene buena calidad
      'SUGGESTED_PARENT_ID', // ID de padre sugerido
      'PRICE_HIGHLIGHT_TIER', // Nivel de precio destacado
      'VEHICLE_TYPE', // Tipo de vehículo
      'FIPE_CODE', // Código FIPE
      'MOLICAR_CODE', // Código Molicar
      'VEHICLE_CLASSIFICATION', // Clasificación del vehículo
      'AGID', // AGID
      'VEHICLE_LANDING', // Vehiculo visible en landings
      'WITH_IRREGULAR_PRICE', // Con variación de precio
      'FIPE_BRAND', // Marca FIPE
      'FIPE_MODEL', // Modelo FIPE
      'FIPE_VEHICLE_YEAR', // Año FIPE
      'FIPE_PRICE', // Precio FIPE
      'PRICE_NEW', // Precio nuevo
      'PRICE_USED', // Precio usado
      'CURRENCY', // Moneda
      'WITH_POSITIVE_IMPACT', // Con impacto positivo
      'VERIFIED_VEHICLES', // Vehiculos verificados
      'VERIFICATION_TYPE', // Tipo de verificación
      'LIMITED_MARKETPLACE_VISIBILITY_REASONS', // Motivos de visibilidad limitada en Marketplace
      'HAS_LOWER_PRICE', // Bajó de precio
      'IS_HIGHLIGHT_BRAND', // Es marca destacada
      'IS_TOM_BRAND', // Es marca TOM
      'SELLER_PACKAGE_HEIGHT', // Altura del paquete del seller
      'SELLER_PACKAGE_LENGTH', // Largo del paquete del seller
      'SELLER_PACKAGE_WEIGHT', // Peso del paquete del seller
      'SELLER_PACKAGE_WIDTH', // Ancho del paquete del seller
    ],
  },
  {
    rule: { action: 'exclude', reason: 'identifiers' },
    ids: [
      'LICENSE_PLATE', // Patente
      'VIN', // VIN
      'VIN_LAST_DIGITS', // Últimos dígitos de la VIN
      'LICENSE_PLATE_PARITY', // Paridad de la patente
      'LICENSE_PLATE_LAST_DIGIT', // Último dígito de la patente
    ],
  },
  {
    rule: { action: 'exclude', reason: 'unconfirmed_warranty' },
    ids: [
      'IS_GUARANTEED_PRE_OWNED', // Seminuevo garantizado
      'WITH_FACTORY_WARRANTY', // Con garantía de fábrica
      'WITH_MECHANICAL_WARRANTY', // Con garantía mecánica
      'MILEAGE_WARRANTY', // Garantía en kilómetros
      'YEAR_WARRANTY', // Garantía en años
    ],
  },
  {
    rule: { action: 'exclude', reason: 'regional_metadata' },
    ids: [
      'GUMMY', // Color de engomado
      'HOLOGRAM', // Holograma
    ],
  },
  {
    rule: { action: 'show', section: 'comfort' },
    ids: [
      'WITH_NEW_WHEELS', // Con llantas nuevas
      'WITH_LUXURY_WHEELS', // Con llantas de lujo
      'HAS_AUTOPILOT', // Piloto automático
      'HAS_AIR_CONDITIONING', // Aire acondicionado
      'HAS_ALLOY_WHEELS', // Llantas de aleación
      'HAS_AMFM_RADIO', // AM/FM
      'HAS_AUXILIARY_PORT', // Entrada auxiliar
      'HAS_BLUETOOTH', // Bluetooth
      'HAS_BULL_BAR', // Defensa delantera
      'HAS_CD_PLAYER', // CD
      'HAS_DVD', // DVD
      'HAS_HEIGHT_ADJUSTABLE_STEERING_WHEEL', // Regulación de altura del volante
      'HAS_ELECTRIC_MIRRORS', // Control eléctrico para los retrovisores
      'HAS_GPS', // GPS
      'HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT', // Asiento conductor regulable en altura
      'HAS_LEATHER_UPHOLSTERY', // Tapizado de cuero
      'HAS_SEMI_LEATHER_UPHOLSTERY', // Tapizado de semicuero
      'HAS_FABRIC_UPHOLSTERY', // Tapizado de tela
      'HAS_MP3_PLAYER', // Reproductor de MP3
      'HAS_ONBOARD_COMPUTER', // Computadora de abordo
      'HAS_PAINTED_BUMPER', // Paragolpes pintados
      'HAS_POWER_WINDOWS', // Cristales eléctricos
      'HAS_REAR_FOLDING_SEAT', // Asiento trasero rebatible
      'HAS_REMOTE_TRUNK_RELEASE', // Apertura remota de baúl
      'HAS_SD_CARD', // Tarjeta SD
      'HAS_SLIDING_ROOF', // Techo solar eléctrico retráctil
      'HAS_SPARE_TYRE_SUPPORT', // Soporte para rueda de auxilio
      'HAS_STEERING_WHEEL_CONTROL', // Comando remoto para radio en el volante
      'HAS_TRAY_COVER', // Capota marítima
      'HAS_TRAY_MAT', // Cobertor de caja
      'HAS_USB', // Entrada USB
      'HAS_ELECTRIC_SEATS', // Asientos eléctricos
      'HAS_REAR_BACKREST', // Respaldo trasero
      'HAS_CENTRAL_POWER_DOOR_LOCKS', // Cierre centralizado de puertas
      'HAS_COASTERS', // Porta vasos
      'HAS_CLIMATE_CONTROL', // Climatizador
      'WITH_MANUAL_GLASSES', // Con vidrios manuales
      'HAS_AUTO_WINDOW_CLOSER', // Cierre automático de vidrios
      'HAS_LUGGAGE_ROOF_RACK', // Porta equipaje en techo
      'WITH_BED_COVER', // Con tapa de caja
      'WITH_THIRD_ROW', // Con tercera fila
      'WITH_NERF_BARS', // Con estribos
      'WITH_SPOILER', // Con alerón
      'WITH_AUDIO_AMPLIFIER', // Con amplificador de audio
      'HAS_REMOTE_DOOR_OPENER', // Apertura remota de puertas
      'HAS_ELECTRIC_SEATS_TILT_DRIVER', // Asiento delantero conductor con regulación eléctrica de inclinación
      'HAS_ELECTRIC_SEATS_BACKREST_TILT_DRIVER', // Asiento delantero conductor con regulación eléctrica de la inclinación del respaldo
      'HAS_ELECTRIC_SEATS_LENGTH_DRIVER', // Asiento delantero conductor con regulación eléctrica longitudinal
      'HAS_FRONT_INTEGRAL_SEATS', // Asiento delantero integral
      'HAS_FRONT_INTEGRAL_DUALPART_SEATS', // Asiento delantero integral bipartido
      'HAS_ELECTRIC_SEATS_HEIGHT_PASSENGER', // Asiento delantero pasajero con regulación eléctrica de altura
      'HAS_ELECTRIC_SEATS_TILT_PASSENGER', // Asiento delantero pasajero con regulación eléctrica de inclinación
      'HAS_ELECTRIC_SEATS_BACKREST_TILT_PASSENGER', // Asiento delantero pasajero con regulación eléctrica de la inclinación del respaldo
      'HAS_ELECTRIC_SEATS_LENGTH_PASSENGER', // Asiento delantero pasajero con regulación eléctrica longitudinal
      'HAS_HEIGHT_ADJUSTABLE_PASSENGER_SEAT', // Asiento acompañante regulable en altura
      'HAS_CENTRAL_ARMREST_REAR_SEAT', // Asiento trasero con apoyabrazo central
      'HAS_LENGHT_ADJUSTABLE_REAR_SEAT', // Asiento trasero con regulación longitudinal
      'HAS_DUALPART_BACKREST_REAR_SEAT', // Asiento trasero con respaldo bipartido
      'HAS_HEATED_FRONT_SEATS', // Asientos delanteros calefaccionados
      'HAS_INDIVIDUAL_FRONT_SEATS', // Asientos delanteros individuales
      'HAS_CRUISE_CONTROL', // Control de velocidad crucero
      'HAS_POWER_FRONT_WINDOWS', // Levantavidrios eléctricos delanteros
      'HAS_POWER_REAR_WINDOWS', // Levantavidrios eléctricos traseros
      'HAS_COASTERS_CENTRAL_REAR', // Posavasos en apoyabrazos central trasero
      'HAS_LENGTH_ADJUSTABLE_STEERING_WHEEL', // Regulación longitudinal del volante
      'HAS_CHROME_ACCENT_PANEL', // Tablero con detalles cromados
      'HAS_ALUMINIUM_ACCENT_PANEL', // Tablero con detalles en aluminio
      'HAS_SPECIAL_COLOR_ACCENT_PANEL', // Tablero con detalles en color especial
      'HAS_WOOD_ACCENT_PANEL', // Tablero con detalles en madera
      'HAS_STEERING_WHEEL_LEATHER', // Volante revestido en cuero
      'HAS_CHROME_HANDLES', // Manijas externas de puertas cromadas
      'HAS_PAINTED_FRONT_BUMPER', // Paragolpe delantero del color del vehículo
      'HAS_SPECIAL_PAINTED_FRONT_BUMPER', // Paragolpe delantero pintados de color especial
      'HAS_PAINTED_REAR_BUMPER', // Paragolpe trasero del color del vehículo
      'HAS_SPECIAL_PAINTED_BACK_BUMPER', // Paragolpe trasero pintados de color especial
      'HAS_ANDROID_AUTO', // Android auto
      'HAS_APPLE_CARPLAY', // Apple CarPlay
      'WITH_PANORAMIC_GLASS_ROOF', // Con techo de vidrio panorámico
      'WITH_SKY_WINDOW', // Con techo solar sky window
      'WITH_PANORAMIC_SOLAR_ROOF', // Con techo solar panorámico
      'WITH_AUTOMATIC_AIR_CONDITIONING_WITH_INDIVIDUAL_CONTROLS', // Con aire acondicionado automático con controles individuales
      'WITH_AUTOMATIC_AIR_CONDITIONING_WITH_INDIVIDUAL_CONTROLS_REAR_PART_3_ZONES', // Con aire acondicionado automático con controles individuales del/tras (3 zonas)
      'WITH_AUTOMATIC_AIR_CONDITIONING_WITH_INDIVIDUAL_CONTROLS_REAR_PART_4_ZONES', // Con aire acondicionado automático con controles individuales del/tras (4 zonas)
      'WITH_AUTOMATIC_AIR_CONDITIONING_WITH_INDIVIDUAL_FRONT_AND_REAR_CONTROLS', // Con aire acondicionado automático con controles individuales delanteros/traseros
      'WITH_AIR_CONDITIONING_WITH_AUTOMATIC_TEMPERATURE_CONTROL', // Con aire acondicionado con control automático de la temperatura
      'WITH_AIR_CONDITIONING_WITH_INDIVIDUAL_CONTROLS', // Con aire acondicionado con controles individuales
      'WITH_ELECTROCHROMIC_INTERNAL_REAR_VIEW_MIRROR', // Con espejo retrovisor interno electro crómico
      'WITH_EXTERNAL_MIRRORS_WITH_AUTOMATIC_TILTING_IN_REVERSE', // Con espejos externos con inclinación automática en marcha atrás
      'WITH_EXTERNAL_REARVIEW_MIRRORS_WITH_ELECTRICAL_FOLDING', // Con espejos retrovisores externos rebatibles eléctricamente
      'WITH_DRIVER_FRONT_SEAT_WITH_ELECTRIC_ADJUSTMENT', // Con asiento del conductor con regulación eléctrica de altura
      'WITH_PASSENGER_FRONT_SEAT_WITH_ELECTRIC_ADJUSTMENT', // Con asiento del pasajero con regulación eléctrica de altura
      'WITH_DRIVER_ARMREST', // Con apoyabrazos conductor
      'WITH_ARMREST_BETWEEN_FRONT_SEATS', // Con apoyabrazos entre los asientos delanteros
      'WITH_FRONT_SEATS_INDIVIDUAL_ARMRESTS', // Con apoyabrazos delanteros individuales
      'WITH_STEEL_WHEELS', // Con llantas de acero
      'WITH_CHROMED_ALLOY_WHEELS', // Con llantas de aleación cromadas
      'WITH_SPECIAL_PAINTED_ALLOY_WHEELS', // Con llantas de aleación en color especial
      'WITH_CHROMED_DOOR_HANDLES', // Con manija de puertas cromadas
      'WITH_PAINTED_DOOR_HANDLES', // Con manija de puertas en color del vehículo
      'WITH_SPECIAL_PAINTED_DOOR_HANDLES', // Con manija de puertas en color especial
      'WITH_CHROMED_FRONT_BUMPER', // Con paragolpes delantero cromado
      'WITH_CHROMED_REAR_BUMPER', // Con paragolpes trasero cromado
      'WITH_CRANKCASE_GUARD', // Con protector de cárter
      'WITH_FUEL_TANK_PROTECTOR', // Con protector de tanque de combustible
      'WITH_STEEL_SPARE_WHEEL', // Con rueda de auxilio de acero
      'WITH_ALLOY_SPARE_WHEEL', // Con rueda de auxilio de aleación
      'WITH_TEMPORARY_SPARE_WHEEL', // Con rueda de auxilio temporal
      'WITH_BLU_RAY', // Con Blu-ray
      'WITH_TOUCH_SCREEN_LCD', // Con LCD con sistema touch screen
      'WITH_PANEL_LCD', // Con LCD en panel
      'WITH_DASHBOARD_LCD', // Con LCD en panel de instrumentos
      'WITH_FRONT_SEAT_BACKREST_LCD', // Con LCD en respaldo asiento delantero
      'WITH_ROOF_LCD', // Con LCD en techo
      'WITH_LCD_BETWEEN_FRONT_SEATS', // Con LCD entre asientos delanteros
      'WITH_LCD_FOR_REAR_SEATS', // Con LCD para asientos traseros
      'WITH_VOICE_ACTIVATED_GPS', // Con sistema de GPS con indicación por voz
      'WITH_VOICE_COMMAND_SYSTEM', // Con sistema de comando de voz
      'WITH_HANDS_FREE_SYSTEM', // Con teléfono celular manos libres
      'WITH_BLUETOOTH_SPEAKER', // Con viva-voz con sistema Bluetooth
    ],
  },
  {
    rule: { action: 'exclude', reason: 'not_vehicle_specification' },
    ids: [
      'MOTO_TYPE', // Tipo de moto
      'SCALE', // Escala
      'VEHICLE_BRAND', // Marca del vehículo
      'INCLUDES_COLOR_CONTROLLER', // Incluye controlador de color
      'INCLUDES_POWER_SUPPLY', // Incluye fuente de alimentación
      'IS_DIMMABLE', // Es dimeable
      'LEDS_PER_METER_NUMBER', // Cantidad de LEDs por metro
      'LED_TYPE', // Tipo de LED
      'PROTECTION_DEGREE', // Grado de protección
      'WITH_WI_FI', // Con Wi-Fi
      'LIGHT_COLOR', // Color de la luz
    ],
  },
] as const;

const rules = new Map<string, VehicleAttributeRule>(
  VEHICLE_ATTRIBUTE_POLICY_GROUPS.flatMap(group => group.ids.map(id => [id, group.rule] as const)),
);

export function getVehicleAttributeRule(id: string): VehicleAttributeRule | undefined {
  return rules.get(id);
}
