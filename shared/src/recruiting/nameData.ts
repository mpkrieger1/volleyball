// Sprint 12: hand-authored name + hometown data.
//
// Hand-curated, best-effort only. Ethnicity tags are APPROXIMATE weighting
// buckets for the generator — they are never user-visible and make no
// demographic precision claim. Hometowns are weighted toward volleyball-
// active US states (CA/TX/FL/IL/NE/MN/WI/PA/OH). Corrections welcome.
//
// Combinatorial space at current counts: 420 × 420 × 310 ≈ 54.7M triples.
// At 1,000-class sampling the birthday-paradox dup probability is < 1%;
// the generator retries on collision so the exit test sees zero dups.

import type { NameEntry, Hometown } from './types';

// ─── First names ───
// Weight 1 everywhere; tag-bucket distribution implicitly weights by count.
// Counts: GENERAL 160, EUROPEAN 90, HISPANIC 60, AFRICAN 50, ASIAN 40, PACIFIC 20.

export const FIRST_NAMES: NameEntry[] = [
  // GENERAL — 160
  ...['Emma','Olivia','Ava','Isabella','Sophia','Mia','Charlotte','Amelia','Harper','Evelyn',
      'Abigail','Emily','Elizabeth','Sofia','Madison','Scarlett','Victoria','Aria','Grace','Chloe',
      'Camila','Penelope','Riley','Layla','Lillian','Nora','Zoey','Mila','Aubrey','Hannah',
      'Lily','Addison','Eleanor','Natalie','Luna','Savannah','Brooklyn','Leah','Zoe','Stella',
      'Hazel','Ellie','Paisley','Audrey','Skylar','Violet','Claire','Bella','Aurora','Lucy',
      'Anna','Samantha','Caroline','Genesis','Aaliyah','Kennedy','Kinsley','Allison','Maya','Sarah',
      'Madelyn','Adeline','Alexa','Ariana','Elena','Gabriella','Naomi','Alice','Sadie','Hailey',
      'Eva','Emilia','Autumn','Quinn','Nevaeh','Piper','Ruby','Serenity','Willow','Everly',
      'Cora','Kaylee','Lydia','Aubree','Arianna','Eliana','Peyton','Melanie','Gianna','Isabelle',
      'Julia','Valentina','Nova','Clara','Vivian','Reagan','Mackenzie','Madeline','Brielle','Delilah',
      'Avery','Andrea','Brynn','Taylor','Morgan','Jordan','Kendall','Mackenzie','Reese','Alyssa',
      'Ashley','Lauren','Megan','Rachel','Jessica','Nicole','Brittany','Amanda','Jennifer','Stephanie',
      'Amy','Laura','Jacqueline','Erica','Danielle','Christina','Amber','Alexis','Kimberly','Heather',
      'Tiffany','Rebecca','Melissa','Crystal','Michelle','Katherine','Andrea','Catherine','Holly','Anna',
      'Shelby','Courtney','Hailey','Brooke','Morgan','Sidney','Kelsey','Hayden','Ryan','Blake',
      'Sloane','Carter','Reese','Finley','Rowan','Blair','Emerson','Campbell','Harper','Parker',
    ].map<NameEntry>((name) => ({ name, tag: 'GENERAL', weight: 1 })),
  // EUROPEAN — 90
  ...['Ingrid','Astrid','Svea','Nadia','Katja','Marta','Petra','Anja','Tatiana','Kira',
      'Natasha','Irina','Ekaterina','Anastasia','Sophia','Giulia','Francesca','Chiara','Alessandra','Martina',
      'Beatrice','Valentina','Giada','Aurora','Gemma','Amelie','Camille','Margaux','Juliette','Celine',
      'Anouk','Manon','Ines','Louise','Alice','Chloé','Elise','Adele','Margot','Lena',
      'Johanna','Greta','Hannah','Emilie','Sofie','Mathilde','Ida','Lotte','Freya','Saoirse',
      'Niamh','Aoife','Siobhan','Caitlin','Maeve','Roisin','Brenna','Aisling','Fiona','Keira',
      'Nora','Greer','Anika','Annika','Mikaela','Tuva','Signe','Linnea','Elin','Karin',
      'Klara','Nika','Jana','Iva','Eva','Magdalena','Wiktoria','Zofia','Olga','Ludmila',
      'Dasha','Galina','Yulia','Alla','Marina','Ksenia','Polina','Alena','Darya','Elina',
    ].map<NameEntry>((name) => ({ name, tag: 'EUROPEAN', weight: 1 })),
  // HISPANIC — 60
  ...['Sofia','Valentina','Camila','Lucia','Emilia','Victoria','Martina','Ximena','Mariana','Regina',
      'Andrea','Daniela','Gabriela','Paula','Ana','Carolina','Renata','Fernanda','Josefina','Elena',
      'Natalia','Luciana','Antonella','Maite','Catalina','Isabela','Rocio','Guadalupe','Paloma','Leonor',
      'Esperanza','Alejandra','Ariadna','Belen','Carmen','Consuelo','Dolores','Estela','Flora','Imelda',
      'Jimena','Lourdes','Magdalena','Nuria','Pilar','Rosario','Silvia','Teresa','Yolanda','Zahra',
      'Mireya','Marisol','Adriana','Veronica','Blanca','Esmeralda','Xiomara','Itzel','Citlali','Noemi',
    ].map<NameEntry>((name) => ({ name, tag: 'HISPANIC', weight: 1 })),
  // AFRICAN — 50
  ...['Amara','Imani','Zuri','Nia','Ayana','Jada','Asia','Aaliyah','Kendra','Latoya',
      'Tamika','Ebony','Monique','Shanice','Tanisha','Keisha','Tamara','Kamala','Raven','Jasmine',
      'Adaeze','Chidinma','Ifeoma','Ngozi','Chiamaka','Adanna','Obiageli','Amaka','Oluchi','Ada',
      'Aisha','Zainab','Fatima','Amani','Sade','Zola','Thandi','Nala','Sanaa','Makena',
      'Zahara','Nyla','Khadija','Safiya','Daliyah','Janae','Shawna','Monyae','Briana','Ciara',
    ].map<NameEntry>((name) => ({ name, tag: 'AFRICAN', weight: 1 })),
  // ASIAN — 40
  ...['Mei','Lin','Ying','Xiuying','Hui','Jing','Yan','Xia','Fang','Qing',
      'Hana','Sakura','Yui','Akari','Aoi','Rin','Momo','Airi','Mio','Sora',
      'Seo-yeon','Ji-woo','Min-ji','Soo-jin','Eun-ji','Ha-eun','Yu-na','Chae-won','Ji-yeon','Na-yeon',
      'Aarushi','Ananya','Priya','Meera','Kavya','Ishita','Riya','Ayesha','Sana','Zara',
    ].map<NameEntry>((name) => ({ name, tag: 'ASIAN', weight: 1 })),
  // PACIFIC — 20
  ...['Leilani','Kailani','Noelani','Mahina','Keala','Alohi','Malia','Nalani','Kapua','Iolana',
      'Moana','Tiare','Vaitiare','Lani','Pualani','Kaia','Makani','Kiana','Liana','Nohea',
    ].map<NameEntry>((name) => ({ name, tag: 'PACIFIC', weight: 1 })),
];

// ─── Last names ───
// Counts: GENERAL 170, EUROPEAN 80, HISPANIC 70, AFRICAN 40, ASIAN 40, PACIFIC 20.

export const LAST_NAMES: NameEntry[] = [
  // GENERAL — 170
  ...['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
      'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
      'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
      'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
      'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
      'Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes',
      'Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper',
      'Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson',
      'Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes',
      'Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez',
      'Powell','Jenkins','Perry','Russell','Sullivan','Bell','Coleman','Butler','Henderson','Barnes',
      'Gonzales','Fisher','Vasquez','Simmons','Romero','Jordan','Patterson','Alexander','Hamilton','Graham',
      'Reynolds','Griffin','Wallace','Moreno','West','Cole','Hayes','Bryant','Herrera','Gibson',
      'Ellis','Tran','Medina','Aguilar','Stevens','Murray','Ford','Castro','Marshall','Owens',
      'Harrison','Fernandez','McDonald','Woods','Washington','Kennedy','Wells','Vargas','Henry','Chen',
      'Freeman','Webb','Tucker','Guzman','Burns','Crawford','Olson','Simpson','Porter','Hunter',
      'Gordon','Mendez','Silva','Shaw','Snyder','Mason','Dixon','Munoz','Hunt','Hicks',
    ].map<NameEntry>((name) => ({ name, tag: 'GENERAL', weight: 1 })),
  // EUROPEAN — 80
  ...['Kowalski','Nowak','Wojcik','Lewandowski','Kaminski','Zielinski','Szymanski','Dabrowski','Kozlowski','Mazur',
      'Novak','Novakova','Svobodova','Dvorak','Horak','Prochazka','Kucera','Pokorny','Hruska','Veselsky',
      'Muller','Schmidt','Schneider','Fischer','Weber','Meyer','Wagner','Becker','Schulz','Hoffmann',
      'Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco',
      'Bernard','Dubois','Moreau','Laurent','Simon','Michel','Leroy','Roux','David','Martinez',
      'Van Der Berg','De Jong','Van Dijk','De Vries','Jansen','Visser','Bakker','Janssen','Meijer','Smit',
      'Andersson','Johansson','Karlsson','Nilsson','Eriksson','Larsson','Olsson','Persson','Svensson','Gustafsson',
      'Petrov','Ivanov','Smirnov','Kuznetsov','Popov','Sokolov','Lebedev','Kozlov','Morozov','Volkov',
    ].map<NameEntry>((name) => ({ name, tag: 'EUROPEAN', weight: 1 })),
  // HISPANIC — 70
  ...['Gonzalez','Rodriguez','Martinez','Hernandez','Lopez','Perez','Sanchez','Ramirez','Torres','Flores',
      'Rivera','Gomez','Diaz','Reyes','Cruz','Morales','Ortiz','Gutierrez','Chavez','Ramos',
      'Alvarez','Castillo','Jimenez','Moreno','Herrera','Romero','Medina','Aguilar','Vargas','Castro',
      'Fernandez','Mendez','Vazquez','Soto','Contreras','Guerrero','Ortega','Delgado','Estrada','Padilla',
      'Navarro','Rojas','Salazar','Pena','Cortez','Rios','Vega','Salinas','Escobar','Acosta',
      'Colon','Cabrera','Montoya','Figueroa','Campos','Ayala','Carrasco','Duran','Espinoza','Fuentes',
      'Galvan','Hidalgo','Lara','Marquez','Meza','Nunez','Orozco','Peralta','Quintero','Suarez',
    ].map<NameEntry>((name) => ({ name, tag: 'HISPANIC', weight: 1 })),
  // AFRICAN — 40
  ...['Washington','Jefferson','Jackson','Robinson','Williams','Brooks','Hayes','Matthews','Freeman','Greene',
      'Adekunle','Adebayo','Okafor','Chukwu','Nwosu','Okoye','Obi','Eze','Ibe','Uche',
      'Achebe','Balogun','Coker','Diallo','Gueye','Kamara','Keita','Mensah','Obeng','Osei',
      'Mbeki','Mandela','Zulu','Ndlovu','Mahlangu','Sithole','Khumalo','Ngcobo','Dlamini','Mthembu',
    ].map<NameEntry>((name) => ({ name, tag: 'AFRICAN', weight: 1 })),
  // ASIAN — 40
  ...['Chen','Wang','Li','Zhang','Liu','Yang','Huang','Zhao','Wu','Zhou',
      'Tanaka','Sato','Suzuki','Takahashi','Ito','Watanabe','Yamamoto','Nakamura','Kobayashi','Kato',
      'Kim','Park','Choi','Jung','Kang','Cho','Yoon','Jang','Im','Han',
      'Patel','Singh','Kumar','Shah','Gupta','Sharma','Mehta','Desai','Khan','Ahmed',
    ].map<NameEntry>((name) => ({ name, tag: 'ASIAN', weight: 1 })),
  // PACIFIC — 20
  ...['Kealoha','Kahale','Kamaka','Kanoa','Kealoha','Mahelona','Naeole','Pukui','Kauhane','Makaula',
      'Tupou','Taufa','Vaihola','Tuilagi','Faleolo','Havili','Toleafoa','Taufa','Malietoa','Tafua',
    ].map<NameEntry>((name) => ({ name, tag: 'PACIFIC', weight: 1 })),
];

// ─── Hometowns ───
// ~310 entries. Regions follow the 4-bucket Team.region scheme.
// Weights: larger/volleyball-strong metros get 3; secondary 2; small 1.

const H = (city: string, state: string, region: 'EAST' | 'CENTRAL' | 'MOUNTAIN' | 'PACIFIC', weight = 1): Hometown => ({
  city, state, region, weight,
});

export const HOMETOWNS: Hometown[] = [
  // EAST (Atlantic to Appalachia)
  H('New York', 'NY', 'EAST', 3), H('Brooklyn', 'NY', 'EAST', 2), H('Albany', 'NY', 'EAST'),
  H('Buffalo', 'NY', 'EAST', 2), H('Rochester', 'NY', 'EAST'), H('Syracuse', 'NY', 'EAST'),
  H('Philadelphia', 'PA', 'EAST', 3), H('Pittsburgh', 'PA', 'EAST', 2), H('Harrisburg', 'PA', 'EAST'),
  H('Lancaster', 'PA', 'EAST'), H('Allentown', 'PA', 'EAST'), H('Erie', 'PA', 'EAST'),
  H('Boston', 'MA', 'EAST', 3), H('Worcester', 'MA', 'EAST'), H('Springfield', 'MA', 'EAST'),
  H('Cambridge', 'MA', 'EAST'), H('Hartford', 'CT', 'EAST'), H('New Haven', 'CT', 'EAST'),
  H('Stamford', 'CT', 'EAST'), H('Bridgeport', 'CT', 'EAST'), H('Providence', 'RI', 'EAST'),
  H('Newark', 'NJ', 'EAST', 2), H('Jersey City', 'NJ', 'EAST', 2), H('Trenton', 'NJ', 'EAST'),
  H('Paterson', 'NJ', 'EAST'), H('Princeton', 'NJ', 'EAST'), H('Camden', 'NJ', 'EAST'),
  H('Washington', 'DC', 'EAST', 2), H('Baltimore', 'MD', 'EAST', 2), H('Annapolis', 'MD', 'EAST'),
  H('Rockville', 'MD', 'EAST'), H('Gaithersburg', 'MD', 'EAST'), H('Silver Spring', 'MD', 'EAST'),
  H('Wilmington', 'DE', 'EAST'), H('Dover', 'DE', 'EAST'),
  H('Richmond', 'VA', 'EAST', 2), H('Virginia Beach', 'VA', 'EAST', 2), H('Norfolk', 'VA', 'EAST'),
  H('Arlington', 'VA', 'EAST'), H('Alexandria', 'VA', 'EAST'), H('Roanoke', 'VA', 'EAST'),
  H('Charlottesville', 'VA', 'EAST'),
  H('Charlotte', 'NC', 'EAST', 3), H('Raleigh', 'NC', 'EAST', 2), H('Greensboro', 'NC', 'EAST'),
  H('Durham', 'NC', 'EAST'), H('Winston-Salem', 'NC', 'EAST'), H('Asheville', 'NC', 'EAST'),
  H('Fayetteville', 'NC', 'EAST'), H('Wilmington', 'NC', 'EAST'),
  H('Columbia', 'SC', 'EAST'), H('Charleston', 'SC', 'EAST', 2), H('Greenville', 'SC', 'EAST'),
  H('Atlanta', 'GA', 'EAST', 3), H('Savannah', 'GA', 'EAST'), H('Augusta', 'GA', 'EAST'),
  H('Athens', 'GA', 'EAST'), H('Columbus', 'GA', 'EAST'), H('Macon', 'GA', 'EAST'),
  H('Marietta', 'GA', 'EAST'), H('Alpharetta', 'GA', 'EAST'),
  H('Miami', 'FL', 'EAST', 3), H('Tampa', 'FL', 'EAST', 3), H('Orlando', 'FL', 'EAST', 3),
  H('Jacksonville', 'FL', 'EAST', 2), H('Fort Lauderdale', 'FL', 'EAST', 2), H('Gainesville', 'FL', 'EAST'),
  H('Tallahassee', 'FL', 'EAST'), H('St. Petersburg', 'FL', 'EAST'), H('Pensacola', 'FL', 'EAST'),
  H('Fort Myers', 'FL', 'EAST'), H('Naples', 'FL', 'EAST'), H('Sarasota', 'FL', 'EAST'),
  H('Boca Raton', 'FL', 'EAST'),
  H('Portland', 'ME', 'EAST'), H('Manchester', 'NH', 'EAST'), H('Burlington', 'VT', 'EAST'),
  H('Charleston', 'WV', 'EAST'), H('Morgantown', 'WV', 'EAST'),

  // CENTRAL (Ohio valley, Great Lakes, Midwest, Plains)
  H('Columbus', 'OH', 'CENTRAL', 3), H('Cleveland', 'OH', 'CENTRAL', 2), H('Cincinnati', 'OH', 'CENTRAL', 2),
  H('Akron', 'OH', 'CENTRAL'), H('Dayton', 'OH', 'CENTRAL'), H('Toledo', 'OH', 'CENTRAL'),
  H('Canton', 'OH', 'CENTRAL'),
  H('Indianapolis', 'IN', 'CENTRAL', 3), H('Fort Wayne', 'IN', 'CENTRAL'), H('Evansville', 'IN', 'CENTRAL'),
  H('Bloomington', 'IN', 'CENTRAL'), H('South Bend', 'IN', 'CENTRAL'), H('Carmel', 'IN', 'CENTRAL'),
  H('Chicago', 'IL', 'CENTRAL', 3), H('Naperville', 'IL', 'CENTRAL', 2), H('Aurora', 'IL', 'CENTRAL'),
  H('Rockford', 'IL', 'CENTRAL'), H('Peoria', 'IL', 'CENTRAL'), H('Springfield', 'IL', 'CENTRAL'),
  H('Champaign', 'IL', 'CENTRAL'), H('Elgin', 'IL', 'CENTRAL'), H('Schaumburg', 'IL', 'CENTRAL'),
  H('Detroit', 'MI', 'CENTRAL', 2), H('Grand Rapids', 'MI', 'CENTRAL', 2), H('Ann Arbor', 'MI', 'CENTRAL'),
  H('Lansing', 'MI', 'CENTRAL'), H('Kalamazoo', 'MI', 'CENTRAL'), H('Flint', 'MI', 'CENTRAL'),
  H('Milwaukee', 'WI', 'CENTRAL', 2), H('Madison', 'WI', 'CENTRAL', 2), H('Green Bay', 'WI', 'CENTRAL'),
  H('Kenosha', 'WI', 'CENTRAL'), H('Appleton', 'WI', 'CENTRAL'), H('Waukesha', 'WI', 'CENTRAL'),
  H('Minneapolis', 'MN', 'CENTRAL', 3), H('St. Paul', 'MN', 'CENTRAL', 2), H('Rochester', 'MN', 'CENTRAL'),
  H('Duluth', 'MN', 'CENTRAL'), H('Bloomington', 'MN', 'CENTRAL'), H('Eagan', 'MN', 'CENTRAL'),
  H('Edina', 'MN', 'CENTRAL'), H('Woodbury', 'MN', 'CENTRAL'),
  H('Des Moines', 'IA', 'CENTRAL', 2), H('Cedar Rapids', 'IA', 'CENTRAL'), H('Davenport', 'IA', 'CENTRAL'),
  H('Iowa City', 'IA', 'CENTRAL'), H('Ames', 'IA', 'CENTRAL'),
  H('St. Louis', 'MO', 'CENTRAL', 2), H('Kansas City', 'MO', 'CENTRAL', 2), H('Springfield', 'MO', 'CENTRAL'),
  H('Columbia', 'MO', 'CENTRAL'), H('Independence', 'MO', 'CENTRAL'),
  H('Omaha', 'NE', 'CENTRAL', 2), H('Lincoln', 'NE', 'CENTRAL', 2), H('Grand Island', 'NE', 'CENTRAL'),
  H('Kearney', 'NE', 'CENTRAL'), H('Bellevue', 'NE', 'CENTRAL'),
  H('Wichita', 'KS', 'CENTRAL'), H('Overland Park', 'KS', 'CENTRAL'), H('Kansas City', 'KS', 'CENTRAL'),
  H('Topeka', 'KS', 'CENTRAL'), H('Olathe', 'KS', 'CENTRAL'), H('Lawrence', 'KS', 'CENTRAL'),
  H('Oklahoma City', 'OK', 'CENTRAL', 2), H('Tulsa', 'OK', 'CENTRAL', 2), H('Norman', 'OK', 'CENTRAL'),
  H('Broken Arrow', 'OK', 'CENTRAL'), H('Edmond', 'OK', 'CENTRAL'),
  H('Little Rock', 'AR', 'CENTRAL'), H('Fayetteville', 'AR', 'CENTRAL'), H('Fort Smith', 'AR', 'CENTRAL'),
  H('Memphis', 'TN', 'CENTRAL', 2), H('Nashville', 'TN', 'CENTRAL', 2), H('Knoxville', 'TN', 'CENTRAL'),
  H('Chattanooga', 'TN', 'CENTRAL'), H('Clarksville', 'TN', 'CENTRAL'),
  H('Louisville', 'KY', 'CENTRAL'), H('Lexington', 'KY', 'CENTRAL'), H('Bowling Green', 'KY', 'CENTRAL'),
  H('Birmingham', 'AL', 'CENTRAL'), H('Huntsville', 'AL', 'CENTRAL'), H('Mobile', 'AL', 'CENTRAL'),
  H('Montgomery', 'AL', 'CENTRAL'), H('Tuscaloosa', 'AL', 'CENTRAL'),
  H('Jackson', 'MS', 'CENTRAL'), H('Gulfport', 'MS', 'CENTRAL'), H('Oxford', 'MS', 'CENTRAL'),
  H('New Orleans', 'LA', 'CENTRAL', 2), H('Baton Rouge', 'LA', 'CENTRAL'), H('Shreveport', 'LA', 'CENTRAL'),
  H('Lafayette', 'LA', 'CENTRAL'),
  H('Fargo', 'ND', 'CENTRAL'), H('Bismarck', 'ND', 'CENTRAL'),
  H('Sioux Falls', 'SD', 'CENTRAL'), H('Rapid City', 'SD', 'CENTRAL'),

  // MOUNTAIN
  H('Denver', 'CO', 'MOUNTAIN', 3), H('Colorado Springs', 'CO', 'MOUNTAIN', 2), H('Aurora', 'CO', 'MOUNTAIN', 2),
  H('Fort Collins', 'CO', 'MOUNTAIN', 2), H('Boulder', 'CO', 'MOUNTAIN', 2), H('Highlands Ranch', 'CO', 'MOUNTAIN'),
  H('Pueblo', 'CO', 'MOUNTAIN'), H('Greeley', 'CO', 'MOUNTAIN'),
  H('Phoenix', 'AZ', 'MOUNTAIN', 3), H('Tucson', 'AZ', 'MOUNTAIN', 2), H('Mesa', 'AZ', 'MOUNTAIN', 2),
  H('Chandler', 'AZ', 'MOUNTAIN'), H('Scottsdale', 'AZ', 'MOUNTAIN', 2), H('Gilbert', 'AZ', 'MOUNTAIN'),
  H('Tempe', 'AZ', 'MOUNTAIN'), H('Flagstaff', 'AZ', 'MOUNTAIN'),
  H('Albuquerque', 'NM', 'MOUNTAIN'), H('Las Cruces', 'NM', 'MOUNTAIN'), H('Santa Fe', 'NM', 'MOUNTAIN'),
  H('Salt Lake City', 'UT', 'MOUNTAIN', 2), H('Provo', 'UT', 'MOUNTAIN', 2), H('Sandy', 'UT', 'MOUNTAIN'),
  H('West Jordan', 'UT', 'MOUNTAIN'), H('Orem', 'UT', 'MOUNTAIN'),
  H('Boise', 'ID', 'MOUNTAIN'), H('Nampa', 'ID', 'MOUNTAIN'), H('Idaho Falls', 'ID', 'MOUNTAIN'),
  H('Pocatello', 'ID', 'MOUNTAIN'),
  H('Billings', 'MT', 'MOUNTAIN'), H('Bozeman', 'MT', 'MOUNTAIN'), H('Missoula', 'MT', 'MOUNTAIN'),
  H('Helena', 'MT', 'MOUNTAIN'),
  H('Cheyenne', 'WY', 'MOUNTAIN'), H('Casper', 'WY', 'MOUNTAIN'),
  H('Reno', 'NV', 'MOUNTAIN'), H('Las Vegas', 'NV', 'MOUNTAIN', 2), H('Henderson', 'NV', 'MOUNTAIN'),
  H('North Las Vegas', 'NV', 'MOUNTAIN'),
  H('El Paso', 'TX', 'MOUNTAIN', 2), H('Lubbock', 'TX', 'MOUNTAIN'), H('Amarillo', 'TX', 'MOUNTAIN'),
  H('Midland', 'TX', 'MOUNTAIN'), H('Odessa', 'TX', 'MOUNTAIN'),

  // PACIFIC
  H('Los Angeles', 'CA', 'PACIFIC', 3), H('San Diego', 'CA', 'PACIFIC', 3), H('San Francisco', 'CA', 'PACIFIC', 2),
  H('San Jose', 'CA', 'PACIFIC', 2), H('Long Beach', 'CA', 'PACIFIC', 2), H('Sacramento', 'CA', 'PACIFIC', 2),
  H('Anaheim', 'CA', 'PACIFIC', 2), H('Oakland', 'CA', 'PACIFIC', 2), H('Fresno', 'CA', 'PACIFIC', 2),
  H('Bakersfield', 'CA', 'PACIFIC'), H('Riverside', 'CA', 'PACIFIC'), H('Santa Ana', 'CA', 'PACIFIC'),
  H('Stockton', 'CA', 'PACIFIC'), H('Irvine', 'CA', 'PACIFIC', 2), H('Chula Vista', 'CA', 'PACIFIC'),
  H('Fremont', 'CA', 'PACIFIC'), H('San Bernardino', 'CA', 'PACIFIC'), H('Modesto', 'CA', 'PACIFIC'),
  H('Oxnard', 'CA', 'PACIFIC'), H('Huntington Beach', 'CA', 'PACIFIC'), H('Glendale', 'CA', 'PACIFIC'),
  H('Santa Barbara', 'CA', 'PACIFIC'), H('Santa Clarita', 'CA', 'PACIFIC'), H('Torrance', 'CA', 'PACIFIC'),
  H('Pasadena', 'CA', 'PACIFIC'), H('Orange', 'CA', 'PACIFIC'), H('Fullerton', 'CA', 'PACIFIC'),
  H('Thousand Oaks', 'CA', 'PACIFIC'), H('Roseville', 'CA', 'PACIFIC'), H('Elk Grove', 'CA', 'PACIFIC'),
  H('Portland', 'OR', 'PACIFIC', 2), H('Eugene', 'OR', 'PACIFIC'), H('Salem', 'OR', 'PACIFIC'),
  H('Gresham', 'OR', 'PACIFIC'), H('Bend', 'OR', 'PACIFIC'), H('Hillsboro', 'OR', 'PACIFIC'),
  H('Beaverton', 'OR', 'PACIFIC'), H('Medford', 'OR', 'PACIFIC'),
  H('Seattle', 'WA', 'PACIFIC', 2), H('Spokane', 'WA', 'PACIFIC', 2), H('Tacoma', 'WA', 'PACIFIC'),
  H('Bellevue', 'WA', 'PACIFIC'), H('Vancouver', 'WA', 'PACIFIC'), H('Kent', 'WA', 'PACIFIC'),
  H('Everett', 'WA', 'PACIFIC'), H('Renton', 'WA', 'PACIFIC'), H('Redmond', 'WA', 'PACIFIC'),
  H('Yakima', 'WA', 'PACIFIC'), H('Olympia', 'WA', 'PACIFIC'),
  H('Anchorage', 'AK', 'PACIFIC'), H('Fairbanks', 'AK', 'PACIFIC'), H('Juneau', 'AK', 'PACIFIC'),
  H('Honolulu', 'HI', 'PACIFIC', 2), H('Hilo', 'HI', 'PACIFIC'), H('Kailua', 'HI', 'PACIFIC'),
  H('Kaneohe', 'HI', 'PACIFIC'), H('Waipahu', 'HI', 'PACIFIC'), H('Pearl City', 'HI', 'PACIFIC'),

  // CENTRAL — Texas gets its own cluster (placed here to keep region logic consistent:
  // Dallas/Austin/Houston are classically Central, not Mountain.)
  H('Houston', 'TX', 'CENTRAL', 3), H('Dallas', 'TX', 'CENTRAL', 3), H('Austin', 'TX', 'CENTRAL', 3),
  H('San Antonio', 'TX', 'CENTRAL', 3), H('Fort Worth', 'TX', 'CENTRAL', 2), H('Plano', 'TX', 'CENTRAL', 2),
  H('Arlington', 'TX', 'CENTRAL'), H('Corpus Christi', 'TX', 'CENTRAL'), H('Garland', 'TX', 'CENTRAL'),
  H('Irving', 'TX', 'CENTRAL'), H('Frisco', 'TX', 'CENTRAL', 2), H('McKinney', 'TX', 'CENTRAL'),
  H('Katy', 'TX', 'CENTRAL'), H('Round Rock', 'TX', 'CENTRAL'), H('Sugar Land', 'TX', 'CENTRAL'),
  H('The Woodlands', 'TX', 'CENTRAL'), H('Pearland', 'TX', 'CENTRAL'), H('Laredo', 'TX', 'CENTRAL'),
  H('Waco', 'TX', 'CENTRAL'), H('College Station', 'TX', 'CENTRAL'),

  // Additional fill (post-review, to reach the 300-city diversity target).
  H('Cary', 'NC', 'EAST'), H('Clearwater', 'FL', 'EAST'), H('Lakeland', 'FL', 'EAST'),
  H('Sanford', 'FL', 'EAST'), H('Kissimmee', 'FL', 'EAST'), H('Melbourne', 'FL', 'EAST'),
  H('Orland Park', 'IL', 'CENTRAL'), H('Bolingbrook', 'IL', 'CENTRAL'), H('Evanston', 'IL', 'CENTRAL'),
  H('Oak Park', 'IL', 'CENTRAL'), H('Naperville', 'IL', 'CENTRAL'), H('Mason City', 'IA', 'CENTRAL'),
  H('West Des Moines', 'IA', 'CENTRAL'), H('Ankeny', 'IA', 'CENTRAL'), H('Waukee', 'IA', 'CENTRAL'),
  H('Santa Monica', 'CA', 'PACIFIC'), H('Manhattan Beach', 'CA', 'PACIFIC'), H('Redondo Beach', 'CA', 'PACIFIC'),
  H('Berkeley', 'CA', 'PACIFIC'), H('Davis', 'CA', 'PACIFIC'),
];
