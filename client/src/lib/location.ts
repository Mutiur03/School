export interface Upazila {
  id: string;
  name: string;
  districtId: string;
}

export interface District {
  id: string;
  name: string;
}

export const districts: District[] = [
  { id: "Joypurhat", name: "Joypurhat" },
  { id: "Bagerhat", name: "Bagerhat" },
  { id: "Bandarban", name: "Bandarban" },
  { id: "Barguna", name: "Barguna" },
  { id: "Barisal", name: "Barisal" },
  { id: "Bhola", name: "Bhola" },
  { id: "Bogura", name: "Bogura" },
  { id: "Brahmanbaria", name: "Brahmanbaria" },
  { id: "Chandpur", name: "Chandpur" },
  { id: "Chapainawabganj", name: "Chapainawabganj" },
  { id: "Chattogram", name: "Chattogram" },
  { id: "Chuadanga", name: "Chuadanga" },
  { id: "Coxsbazar", name: "Coxsbazar" },
  { id: "Cumilla", name: "Cumilla" },
  { id: "Dhaka", name: "Dhaka" },
  { id: "Dinajpur", name: "Dinajpur" },
  { id: "Faridpur", name: "Faridpur" },
  { id: "Feni", name: "Feni" },
  { id: "Gaibandha", name: "Gaibandha" },
  { id: "Gazipur", name: "Gazipur" },
  { id: "Gopalganj", name: "Gopalganj" },
  { id: "Habiganj", name: "Habiganj" },
  { id: "Jamalpur", name: "Jamalpur" },
  { id: "Jashore", name: "Jashore" },
  { id: "Jhalakati", name: "Jhalakati" },
  { id: "Jhenaidah", name: "Jhenaidah" },
  { id: "Khagrachhari", name: "Khagrachhari" },
  { id: "Khulna", name: "Khulna" },
  { id: "Kishoreganj", name: "Kishoreganj" },
  { id: "Kurigram", name: "Kurigram" },
  { id: "Kushtia", name: "Kushtia" },
  { id: "Lakshmipur", name: "Lakshmipur" },
  { id: "Lalmonirhat", name: "Lalmonirhat" },
  { id: "Madaripur", name: "Madaripur" },
  { id: "Magura", name: "Magura" },
  { id: "Manikganj", name: "Manikganj" },
  { id: "Maulavibazar", name: "Maulavibazar" },
  { id: "Meherpur", name: "Meherpur" },
  { id: "Munshiganj", name: "Munshiganj" },
  { id: "Mymensingh", name: "Mymensingh" },
  { id: "Naogaon", name: "Naogaon" },
  { id: "Narail", name: "Narail" },
  { id: "Netrakona", name: "Netrakona" },
  { id: "Nilphamari", name: "Nilphamari" },
  { id: "Noakhali", name: "Noakhali" },
  { id: "Pabna", name: "Pabna" },
  { id: "Panchagarh", name: "Panchagarh" },
  { id: "Patuakhali", name: "Patuakhali" },
  { id: "Pirojpur", name: "Pirojpur" },
  { id: "Rajbari", name: "Rajbari" },
  { id: "Rajshahi", name: "Rajshahi" },
  { id: "Rangamati", name: "Rangamati" },
  { id: "Rangpur", name: "Rangpur" },
  { id: "Satkhira", name: "Satkhira" },
  { id: "Shariatpur", name: "Shariatpur" },
  { id: "Sherpur", name: "Sherpur" },
  { id: "Sirajganj", name: "Sirajganj" },
  { id: "Sunamganj", name: "Sunamganj" },
  { id: "Sylhet", name: "Sylhet" },
  { id: "Tangail", name: "Tangail" },
  { id: "Thakurgaon", name: "Thakurgaon" },
];

export const upazilas: Upazila[] = [
  // Bagerhat District
  { id: "Bagerhat Sadar", name: "Bagerhat Sadar", districtId: "Bagerhat" },
  { id: "Chitalmari", name: "Chitalmari", districtId: "Bagerhat" },
  { id: "Fakirhat", name: "Fakirhat", districtId: "Bagerhat" },
  { id: "Kachua", name: "Kachua", districtId: "Bagerhat" },
  { id: "Mollahat", name: "Mollahat", districtId: "Bagerhat" },
  { id: "Mongla", name: "Mongla", districtId: "Bagerhat" },
  { id: "Morrelganj", name: "Morrelganj", districtId: "Bagerhat" },
  { id: "Rampal", name: "Rampal", districtId: "Bagerhat" },
  { id: "Sharankhola", name: "Sharankhola", districtId: "Bagerhat" },

  // Bandarban District
  { id: "Alikadam", name: "Alikadam", districtId: "Bandarban" },
  { id: "Bandarban Sadar", name: "Bandarban Sadar", districtId: "Bandarban" },
  { id: "Lama", name: "Lama", districtId: "Bandarban" },
  { id: "Naikhongchhari", name: "Naikhongchhari", districtId: "Bandarban" },
  { id: "Rowangchhari", name: "Rowangchhari", districtId: "Bandarban" },
  { id: "Ruma", name: "Ruma", districtId: "Bandarban" },
  { id: "Thanchi", name: "Thanchi", districtId: "Bandarban" },

  // Barguna District
  { id: "Amtali", name: "Amtali", districtId: "Barguna" },
  { id: "Bamna", name: "Bamna", districtId: "Barguna" },
  { id: "Barguna Sadar", name: "Barguna Sadar", districtId: "Barguna" },
  { id: "Betagi", name: "Betagi", districtId: "Barguna" },
  { id: "Patharghata", name: "Patharghata", districtId: "Barguna" },

  // Barisal District
  { id: "Agailjhara", name: "Agailjhara", districtId: "Barisal" },
  { id: "Babuganj", name: "Babuganj", districtId: "Barisal" },
  { id: "Bakerganj", name: "Bakerganj", districtId: "Barisal" },
  { id: "Banaripara", name: "Banaripara", districtId: "Barisal" },
  { id: "Barisal Sadar", name: "Barisal Sadar", districtId: "Barisal" },
  { id: "Gaurnadi", name: "Gaurnadi", districtId: "Barisal" },
  { id: "Hizla", name: "Hizla", districtId: "Barisal" },
  { id: "Mehendiganj", name: "Mehendiganj", districtId: "Barisal" },
  { id: "Muladi", name: "Muladi", districtId: "Barisal" },
  { id: "Wazirpur", name: "Wazirpur", districtId: "Barisal" },

  // Bhola District
  { id: "Bhola Sadar", name: "Bhola Sadar", districtId: "Bhola" },
  { id: "Burhanuddin", name: "Burhanuddin", districtId: "Bhola" },
  { id: "Char Fasson", name: "Char Fasson", districtId: "Bhola" },
  { id: "Daulatkhan", name: "Daulatkhan", districtId: "Bhola" },
  { id: "Lalmohan", name: "Lalmohan", districtId: "Bhola" },
  { id: "Manpura", name: "Manpura", districtId: "Bhola" },
  { id: "Tazumuddin", name: "Tazumuddin", districtId: "Bhola" },

  // Bogura District
  { id: "Adamdighi", name: "Adamdighi", districtId: "Bogura" },
  { id: "Bogra Sadar", name: "Bogra Sadar", districtId: "Bogura" },
  { id: "Dhunat", name: "Dhunat", districtId: "Bogura" },
  { id: "Dupchanchia", name: "Dupchanchia", districtId: "Bogura" },
  { id: "Gabtali", name: "Gabtali", districtId: "Bogura" },
  { id: "Kahaloo", name: "Kahaloo", districtId: "Bogura" },
  { id: "Nandigram", name: "Nandigram", districtId: "Bogura" },
  { id: "Sariakandi", name: "Sariakandi", districtId: "Bogura" },
  { id: "Shajahanpur", name: "Shajahanpur", districtId: "Bogura" },
  { id: "Sherpur", name: "Sherpur", districtId: "Bogura" },
  { id: "Shibganj", name: "Shibganj", districtId: "Bogura" },
  { id: "Sonatala", name: "Sonatala", districtId: "Bogura" },

  // Brahmanbaria District
  { id: "Akhaura", name: "Akhaura", districtId: "Brahmanbaria" },
  { id: "Ashuganj", name: "Ashuganj", districtId: "Brahmanbaria" },
  { id: "Bancharampur", name: "Bancharampur", districtId: "Brahmanbaria" },
  { id: "Bijoynagar", name: "Bijoynagar", districtId: "Brahmanbaria" },
  {
    id: "Brahmanbaria Sadar",
    name: "Brahmanbaria Sadar",
    districtId: "Brahmanbaria",
  },
  { id: "Kasba", name: "Kasba", districtId: "Brahmanbaria" },
  { id: "Nabinagar", name: "Nabinagar", districtId: "Brahmanbaria" },
  { id: "Nasirnagar", name: "Nasirnagar", districtId: "Brahmanbaria" },
  { id: "Sarail", name: "Sarail", districtId: "Brahmanbaria" },

  // Chandpur District
  { id: "Chandpur Sadar", name: "Chandpur Sadar", districtId: "Chandpur" },
  { id: "Faridganj", name: "Faridganj", districtId: "Chandpur" },
  { id: "Haimchar", name: "Haimchar", districtId: "Chandpur" },
  { id: "Hajiganj", name: "Hajiganj", districtId: "Chandpur" },
  { id: "Kachua", name: "Kachua", districtId: "Chandpur" },
  { id: "Matlab Dakshin", name: "Matlab Dakshin", districtId: "Chandpur" },
  { id: "Matlab Uttar", name: "Matlab Uttar", districtId: "Chandpur" },
  { id: "Shahrasti", name: "Shahrasti", districtId: "Chandpur" },

  // Chapainawabganj District
  { id: "Bholahat", name: "Bholahat", districtId: "Chapainawabganj" },
  {
    id: "Chapai Nawabganj Sadar",
    name: "Chapai Nawabganj Sadar",
    districtId: "Chapainawabganj",
  },
  { id: "Gomastapur", name: "Gomastapur", districtId: "Chapainawabganj" },
  { id: "Nachole", name: "Nachole", districtId: "Chapainawabganj" },
  { id: "Shibganj", name: "Shibganj", districtId: "Chapainawabganj" },

  // Dhaka District
  { id: "Dhanmondi", name: "Dhanmondi", districtId: "Dhaka" },
  { id: "Gulshan", name: "Gulshan", districtId: "Dhaka" },
  { id: "Uttara", name: "Uttara", districtId: "Dhaka" },
  { id: "Mirpur", name: "Mirpur", districtId: "Dhaka" },
  { id: "Tejgaon", name: "Tejgaon", districtId: "Dhaka" },
  { id: "Ramna", name: "Ramna", districtId: "Dhaka" },

  // Chattogram District - Updated with complete list
  { id: "Anowara", name: "Anowara", districtId: "Chattogram" },
  { id: "Bakalia", name: "Bakalia", districtId: "Chattogram" },
  { id: "Bandar", name: "Bandar", districtId: "Chattogram" },
  { id: "Banshkhali", name: "Banshkhali", districtId: "Chattogram" },
  { id: "Bayejid", name: "Bayejid", districtId: "Chattogram" },
  { id: "Boalkhali", name: "Boalkhali", districtId: "Chattogram" },
  { id: "Chandanaish", name: "Chandanaish", districtId: "Chattogram" },
  { id: "Chandgaon", name: "Chandgaon", districtId: "Chattogram" },
  { id: "Double Mooring", name: "Double Mooring", districtId: "Chattogram" },
  { id: "Fatikchhari", name: "Fatikchhari", districtId: "Chattogram" },
  { id: "Halishahar", name: "Halishahar", districtId: "Chattogram" },
  { id: "Hathazari", name: "Hathazari", districtId: "Chattogram" },
  { id: "Khulshi", name: "Khulshi", districtId: "Chattogram" },
  { id: "Kotwali", name: "Kotwali", districtId: "Chattogram" },
  { id: "Lohagara", name: "Lohagara", districtId: "Chattogram" },
  { id: "Mirsharai", name: "Mirsharai", districtId: "Chattogram" },
  { id: "Pahartali", name: "Pahartali", districtId: "Chattogram" },
  { id: "Panchlaish", name: "Panchlaish", districtId: "Chattogram" },
  { id: "Patenga", name: "Patenga", districtId: "Chattogram" },
  { id: "Patiya", name: "Patiya", districtId: "Chattogram" },
  { id: "Rangunia", name: "Rangunia", districtId: "Chattogram" },
  { id: "Raozan", name: "Raozan", districtId: "Chattogram" },
  { id: "SanABip", name: "SanABip", districtId: "Chattogram" },
  { id: "Satkania", name: "Satkania", districtId: "Chattogram" },
  { id: "Sitakunda", name: "Sitakunda", districtId: "Chattogram" },

  // Chuadanga District
  { id: "Alamdanga", name: "Alamdanga", districtId: "Chuadanga" },
  { id: "Chuadanga Sadar", name: "Chuadanga Sadar", districtId: "Chuadanga" },
  { id: "Damurhuda", name: "Damurhuda", districtId: "Chuadanga" },
  { id: "Jibannagar", name: "Jibannagar", districtId: "Chuadanga" },

  // Coxsbazar District
  { id: "Chakaria", name: "Chakaria", districtId: "Coxsbazar" },
  {
    id: "Cox's Bazar Sadar",
    name: "Cox's Bazar Sadar",
    districtId: "Coxsbazar",
  },
  { id: "Eidgaon", name: "Eidgaon", districtId: "Coxsbazar" },
  { id: "Kutubdia", name: "Kutubdia", districtId: "Coxsbazar" },
  { id: "Maheshkhali", name: "Maheshkhali", districtId: "Coxsbazar" },
  { id: "Pekua", name: "Pekua", districtId: "Coxsbazar" },
  { id: "Ramu", name: "Ramu", districtId: "Coxsbazar" },
  { id: "Teknaf", name: "Teknaf", districtId: "Coxsbazar" },
  { id: "Ukhia", name: "Ukhia", districtId: "Coxsbazar" },

  // Cumilla District
  { id: "Barura", name: "Barura", districtId: "Cumilla" },
  { id: "Brahmanpara", name: "Brahmanpara", districtId: "Cumilla" },
  { id: "Burichang", name: "Burichang", districtId: "Cumilla" },
  { id: "Chandina", name: "Chandina", districtId: "Cumilla" },
  { id: "Chauddagram", name: "Chauddagram", districtId: "Cumilla" },
  {
    id: "Comilla Adarsha Sadar",
    name: "Comilla Adarsha Sadar",
    districtId: "Cumilla",
  },
  {
    id: "Comilla Sadar Dakshin",
    name: "Comilla Sadar Dakshin",
    districtId: "Cumilla",
  },
  { id: "Daudkandi", name: "Daudkandi", districtId: "Cumilla" },
  { id: "Debidwar", name: "Debidwar", districtId: "Cumilla" },
  { id: "Homna", name: "Homna", districtId: "Cumilla" },
  { id: "Laksham", name: "Laksham", districtId: "Cumilla" },
  { id: "Manoharganj", name: "Manoharganj", districtId: "Cumilla" },
  { id: "Meghna", name: "Meghna", districtId: "Cumilla" },
  { id: "Muradnagar", name: "Muradnagar", districtId: "Cumilla" },
  { id: "Nangalkot", name: "Nangalkot", districtId: "Cumilla" },
  { id: "Titas", name: "Titas", districtId: "Cumilla" },

  // Dhaka District - Updated with complete list
  { id: "Adabor", name: "Adabor", districtId: "Dhaka" },
  { id: "Badda", name: "Badda", districtId: "Dhaka" },
  { id: "Bangshal", name: "Bangshal", districtId: "Dhaka" },
  { id: "Biman Bandar", name: "Biman Bandar", districtId: "Dhaka" },
  { id: "Cantonment", name: "Cantonment", districtId: "Dhaka" },
  { id: "Chawkbazar", name: "Chawkbazar", districtId: "Dhaka" },
  { id: "Dakshinkhan", name: "Dakshinkhan", districtId: "Dhaka" },
  { id: "Darus Salam", name: "Darus Salam", districtId: "Dhaka" },
  { id: "Demra", name: "Demra", districtId: "Dhaka" },
  { id: "Dhamrai", name: "Dhamrai", districtId: "Dhaka" },
  { id: "Dhanmondi", name: "Dhanmondi", districtId: "Dhaka" },
  { id: "Dohar", name: "Dohar", districtId: "Dhaka" },
  { id: "Gendaria", name: "Gendaria", districtId: "Dhaka" },
  { id: "Gulshan", name: "Gulshan", districtId: "Dhaka" },
  { id: "Hazaribagh", name: "Hazaribagh", districtId: "Dhaka" },
  { id: "Jatrabari", name: "Jatrabari", districtId: "Dhaka" },
  { id: "Kadamtali", name: "Kadamtali", districtId: "Dhaka" },
  { id: "Kafrul", name: "Kafrul", districtId: "Dhaka" },
  { id: "Kalabagan", name: "Kalabagan", districtId: "Dhaka" },
  { id: "Kamrangirchar", name: "Kamrangirchar", districtId: "Dhaka" },
  { id: "Keraniganj", name: "Keraniganj", districtId: "Dhaka" },
  { id: "Khilgaon", name: "Khilgaon", districtId: "Dhaka" },
  { id: "Khilkhet", name: "Khilkhet", districtId: "Dhaka" },
  { id: "Kotwali", name: "Kotwali", districtId: "Dhaka" },
  { id: "Lalbagh", name: "Lalbagh", districtId: "Dhaka" },
  { id: "Mirpur", name: "Mirpur", districtId: "Dhaka" },
  { id: "Mohammadpur", name: "Mohammadpur", districtId: "Dhaka" },
  { id: "Motijheel", name: "Motijheel", districtId: "Dhaka" },
  { id: "Nawabganj", name: "Nawabganj", districtId: "Dhaka" },
  { id: "New Market", name: "New Market", districtId: "Dhaka" },
  { id: "Pallabi", name: "Pallabi", districtId: "Dhaka" },
  { id: "Paltan", name: "Paltan", districtId: "Dhaka" },
  { id: "Ramna", name: "Ramna", districtId: "Dhaka" },
  { id: "Rampura", name: "Rampura", districtId: "Dhaka" },
  { id: "Sabujbagh", name: "Sabujbagh", districtId: "Dhaka" },
  { id: "Savar", name: "Savar", districtId: "Dhaka" },
  { id: "Shah Ali", name: "Shah Ali", districtId: "Dhaka" },
  { id: "Shahbagh", name: "Shahbagh", districtId: "Dhaka" },
  {
    id: "Sher-E-Bangla Nagar",
    name: "Sher-E-Bangla Nagar",
    districtId: "Dhaka",
  },
  { id: "Shyampur", name: "Shyampur", districtId: "Dhaka" },
  { id: "Sutrapur", name: "Sutrapur", districtId: "Dhaka" },
  { id: "Tejgaon", name: "Tejgaon", districtId: "Dhaka" },
  {
    id: "Tejgaon Industrial Area",
    name: "Tejgaon Industrial Area",
    districtId: "Dhaka",
  },

  // Dinajpur District
  { id: "Biral", name: "Biral", districtId: "Dinajpur" },
  { id: "Birampur", name: "Birampur", districtId: "Dinajpur" },
  { id: "Birganj", name: "Birganj", districtId: "Dinajpur" },
  { id: "Bochaganj", name: "Bochaganj", districtId: "Dinajpur" },
  { id: "Chirirbandar", name: "Chirirbandar", districtId: "Dinajpur" },
  { id: "Dinajpur Sadar", name: "Dinajpur Sadar", districtId: "Dinajpur" },
  { id: "Ghoraghat", name: "Ghoraghat", districtId: "Dinajpur" },
  { id: "Hakimpur", name: "Hakimpur", districtId: "Dinajpur" },
  { id: "Kaharole", name: "Kaharole", districtId: "Dinajpur" },
  { id: "Khansama", name: "Khansama", districtId: "Dinajpur" },
  { id: "Nawabganj", name: "Nawabganj", districtId: "Dinajpur" },
  { id: "Parbatipur", name: "Parbatipur", districtId: "Dinajpur" },
  { id: "Phulbari", name: "Phulbari", districtId: "Dinajpur" },

  // Faridpur District
  { id: "Alfadanga", name: "Alfadanga", districtId: "Faridpur" },
  { id: "Bhanga", name: "Bhanga", districtId: "Faridpur" },
  { id: "Boalmari", name: "Boalmari", districtId: "Faridpur" },
  { id: "Charbhadrasan", name: "Charbhadrasan", districtId: "Faridpur" },
  { id: "Faridpur Sadar", name: "Faridpur Sadar", districtId: "Faridpur" },
  { id: "Madhukhali", name: "Madhukhali", districtId: "Faridpur" },
  { id: "Nagarkanda", name: "Nagarkanda", districtId: "Faridpur" },
  { id: "Sadarpur", name: "Sadarpur", districtId: "Faridpur" },
  { id: "Saltha", name: "Saltha", districtId: "Faridpur" },

  // Feni District
  { id: "Chhagalnaiya", name: "Chhagalnaiya", districtId: "Feni" },
  { id: "Daganbhuiyan", name: "Daganbhuiyan", districtId: "Feni" },
  { id: "Feni Sadar", name: "Feni Sadar", districtId: "Feni" },
  { id: "Fulgazi", name: "Fulgazi", districtId: "Feni" },
  { id: "Parshuram", name: "Parshuram", districtId: "Feni" },
  { id: "Sonagazi", name: "Sonagazi", districtId: "Feni" },

  // Gaibandha District
  { id: "Gaibandha Sadar", name: "Gaibandha Sadar", districtId: "Gaibandha" },
  { id: "Gobindaganj", name: "Gobindaganj", districtId: "Gaibandha" },
  { id: "Palashbari", name: "Palashbari", districtId: "Gaibandha" },
  { id: "Phulchhari", name: "Phulchhari", districtId: "Gaibandha" },
  { id: "Sadullapur", name: "Sadullapur", districtId: "Gaibandha" },
  { id: "Saghata", name: "Saghata", districtId: "Gaibandha" },
  { id: "Sundarganj", name: "Sundarganj", districtId: "Gaibandha" },

  // Gazipur District
  { id: "Gazipur Sadar", name: "Gazipur Sadar", districtId: "Gazipur" },
  { id: "Kaliakair", name: "Kaliakair", districtId: "Gazipur" },
  { id: "Kaliganj", name: "Kaliganj", districtId: "Gazipur" },
  { id: "Kapasia", name: "Kapasia", districtId: "Gazipur" },
  { id: "Sripur", name: "Sripur", districtId: "Gazipur" },

  // Gopalganj District
  { id: "Gopalganj Sadar", name: "Gopalganj Sadar", districtId: "Gopalganj" },
  { id: "Kashiani", name: "Kashiani", districtId: "Gopalganj" },
  { id: "Kotalipara", name: "Kotalipara", districtId: "Gopalganj" },
  { id: "Muksudpur", name: "Muksudpur", districtId: "Gopalganj" },
  { id: "Tungipara", name: "Tungipara", districtId: "Gopalganj" },

  // Habiganj District
  { id: "Ajmiriganj", name: "Ajmiriganj", districtId: "Habiganj" },
  { id: "Bahubal", name: "Bahubal", districtId: "Habiganj" },
  { id: "Baniachang", name: "Baniachang", districtId: "Habiganj" },
  { id: "Chunarughat", name: "Chunarughat", districtId: "Habiganj" },
  { id: "Habiganj Sadar", name: "Habiganj Sadar", districtId: "Habiganj" },
  { id: "Lakhai", name: "Lakhai", districtId: "Habiganj" },
  { id: "Madhabpur", name: "Madhabpur", districtId: "Habiganj" },
  { id: "Nabiganj", name: "Nabiganj", districtId: "Habiganj" },

  // Joypurhat District
  { id: "Panchbibi", name: "Panchbibi", districtId: "Joypurhat" },
  { id: "Akkelpur", name: "Akkelpur", districtId: "Joypurhat" },
  { id: "Joypurhat Sadar", name: "Joypurhat Sadar", districtId: "Joypurhat" },
  { id: "Kalai", name: "Kalai", districtId: "Joypurhat" },
  { id: "Khetlal", name: "Khetlal", districtId: "Joypurhat" },

  // Jamalpur District
  { id: "Bakshiganj", name: "Bakshiganj", districtId: "Jamalpur" },
  { id: "Dewanganj", name: "Dewanganj", districtId: "Jamalpur" },
  { id: "Islampur", name: "Islampur", districtId: "Jamalpur" },
  { id: "Jamalpur Sadar", name: "Jamalpur Sadar", districtId: "Jamalpur" },
  { id: "Madarganj", name: "Madarganj", districtId: "Jamalpur" },
  { id: "Melandaha", name: "Melandaha", districtId: "Jamalpur" },
  { id: "Sarishabari", name: "Sarishabari", districtId: "Jamalpur" },

  // Jashore District
  { id: "Abhaynagar", name: "Abhaynagar", districtId: "Jashore" },
  { id: "Bagherpara", name: "Bagherpara", districtId: "Jashore" },
  { id: "Chaugachha", name: "Chaugachha", districtId: "Jashore" },
  { id: "Jessore Sadar", name: "Jessore Sadar", districtId: "Jashore" },
  { id: "Jhikargacha", name: "Jhikargacha", districtId: "Jashore" },
  { id: "Keshabpur", name: "Keshabpur", districtId: "Jashore" },
  { id: "Manirampur", name: "Manirampur", districtId: "Jashore" },
  { id: "Sharsha", name: "Sharsha", districtId: "Jashore" },

  // Jhalakati District
  { id: "Jhalakati Sadar", name: "Jhalakati Sadar", districtId: "Jhalakati" },
  { id: "Kanthalia", name: "Kanthalia", districtId: "Jhalakati" },
  { id: "Nalchiti", name: "Nalchiti", districtId: "Jhalakati" },
  { id: "Rajapur", name: "Rajapur", districtId: "Jhalakati" },

  // Jhenaidah District
  { id: "Harinakundu", name: "Harinakundu", districtId: "Jhenaidah" },
  { id: "Jhenaidah Sadar", name: "Jhenaidah Sadar", districtId: "Jhenaidah" },
  { id: "Kaliganj", name: "Kaliganj", districtId: "Jhenaidah" },
  { id: "Kotchandpur", name: "Kotchandpur", districtId: "Jhenaidah" },
  { id: "Maheshpur", name: "Maheshpur", districtId: "Jhenaidah" },
  { id: "Shailkupa", name: "Shailkupa", districtId: "Jhenaidah" },

  // Khagrachhari District
  { id: "Dighinala", name: "Dighinala", districtId: "Khagrachhari" },
  {
    id: "Khagrachhari Sadar",
    name: "Khagrachhari Sadar",
    districtId: "Khagrachhari",
  },
  { id: "Lakshmichhari", name: "Lakshmichhari", districtId: "Khagrachhari" },
  { id: "Mahalchhari", name: "Mahalchhari", districtId: "Khagrachhari" },
  { id: "Manikchhari", name: "Manikchhari", districtId: "Khagrachhari" },
  { id: "Matiranga", name: "Matiranga", districtId: "Khagrachhari" },
  { id: "Panchhari", name: "Panchhari", districtId: "Khagrachhari" },
  { id: "Ramgarh", name: "Ramgarh", districtId: "Khagrachhari" },

  // Khulna District
  { id: "Batiaghata", name: "Batiaghata", districtId: "Khulna" },
  { id: "Dacope", name: "Dacope", districtId: "Khulna" },
  { id: "Daulatpur", name: "Daulatpur", districtId: "Khulna" },
  { id: "Dighalia", name: "Dighalia", districtId: "Khulna" },
  { id: "Dumuria", name: "Dumuria", districtId: "Khulna" },
  { id: "Khalishpur", name: "Khalishpur", districtId: "Khulna" },
  { id: "Khan Jahan Ali", name: "Khan Jahan Ali", districtId: "Khulna" },
  { id: "Khulna Sadar", name: "Khulna Sadar", districtId: "Khulna" },
  { id: "Koyra", name: "Koyra", districtId: "Khulna" },
  { id: "Paikgachha", name: "Paikgachha", districtId: "Khulna" },
  { id: "Phultala", name: "Phultala", districtId: "Khulna" },
  { id: "Rupsa", name: "Rupsa", districtId: "Khulna" },
  { id: "Sonadanga", name: "Sonadanga", districtId: "Khulna" },
  { id: "Terokhada", name: "Terokhada", districtId: "Khulna" },

  // Kishoreganj District
  { id: "Austagram", name: "Austagram", districtId: "Kishoreganj" },
  { id: "Bajitpur", name: "Bajitpur", districtId: "Kishoreganj" },
  { id: "Bhairab", name: "Bhairab", districtId: "Kishoreganj" },
  { id: "Hossainpur", name: "Hossainpur", districtId: "Kishoreganj" },
  { id: "Itna", name: "Itna", districtId: "Kishoreganj" },
  { id: "Karimganj", name: "Karimganj", districtId: "Kishoreganj" },
  { id: "Katiadi", name: "Katiadi", districtId: "Kishoreganj" },
  {
    id: "Kishoreganj Sadar",
    name: "Kishoreganj Sadar",
    districtId: "Kishoreganj",
  },
  { id: "Kuliarchar", name: "Kuliarchar", districtId: "Kishoreganj" },
  { id: "Mithamain", name: "Mithamain", districtId: "Kishoreganj" },
  { id: "Nikli", name: "Nikli", districtId: "Kishoreganj" },
  { id: "Pakundia", name: "Pakundia", districtId: "Kishoreganj" },
  { id: "Tarail", name: "Tarail", districtId: "Kishoreganj" },

  // Kurigram District
  { id: "Bhurungamari", name: "Bhurungamari", districtId: "Kurigram" },
  { id: "Char Rajibpur", name: "Char Rajibpur", districtId: "Kurigram" },
  { id: "Chilmari", name: "Chilmari", districtId: "Kurigram" },
  { id: "Kurigram Sadar", name: "Kurigram Sadar", districtId: "Kurigram" },
  { id: "Nageshwari", name: "Nageshwari", districtId: "Kurigram" },
  { id: "Phulbari", name: "Phulbari", districtId: "Kurigram" },
  { id: "Rajarhat", name: "Rajarhat", districtId: "Kurigram" },
  { id: "Raumari", name: "Raumari", districtId: "Kurigram" },
  { id: "Ulipur", name: "Ulipur", districtId: "Kurigram" },

  // Kushtia District
  { id: "Bheramara", name: "Bheramara", districtId: "Kushtia" },
  { id: "Daulatpur", name: "Daulatpur", districtId: "Kushtia" },
  { id: "Khoksa", name: "Khoksa", districtId: "Kushtia" },
  { id: "Kumarkhali", name: "Kumarkhali", districtId: "Kushtia" },
  { id: "Kushtia Sadar", name: "Kushtia Sadar", districtId: "Kushtia" },
  { id: "Mirpur", name: "Mirpur", districtId: "Kushtia" },

  // Lakshmipur District
  { id: "Kamalnagar", name: "Kamalnagar", districtId: "Lakshmipur" },
  {
    id: "Lakshmipur Sadar",
    name: "Lakshmipur Sadar",
    districtId: "Lakshmipur",
  },
  { id: "Raipur", name: "Raipur", districtId: "Lakshmipur" },
  { id: "Ramganj", name: "Ramganj", districtId: "Lakshmipur" },
  { id: "Ramgati", name: "Ramgati", districtId: "Lakshmipur" },

  // Lalmonirhat District
  { id: "Aditmari", name: "Aditmari", districtId: "Lalmonirhat" },
  { id: "Hatibandha", name: "Hatibandha", districtId: "Lalmonirhat" },
  { id: "Kaliganj", name: "Kaliganj", districtId: "Lalmonirhat" },
  {
    id: "Lalmonirhat Sadar",
    name: "Lalmonirhat Sadar",
    districtId: "Lalmonirhat",
  },
  { id: "Patgram", name: "Patgram", districtId: "Lalmonirhat" },

  // Madaripur District
  { id: "Dasa", name: "Dasa", districtId: "Madaripur" },
  { id: "Kalkini", name: "Kalkini", districtId: "Madaripur" },
  { id: "Madaripur Sadar", name: "Madaripur Sadar", districtId: "Madaripur" },
  { id: "Rajoir", name: "Rajoir", districtId: "Madaripur" },
  { id: "Shibchar", name: "Shibchar", districtId: "Madaripur" },

  // Magura District
  { id: "Magura Sadar", name: "Magura Sadar", districtId: "Magura" },
  { id: "Mohammadpur", name: "Mohammadpur", districtId: "Magura" },
  { id: "Shalikha", name: "Shalikha", districtId: "Magura" },
  { id: "Sreepur", name: "Sreepur", districtId: "Magura" },

  // Manikganj District
  { id: "Daulatpur", name: "Daulatpur", districtId: "Manikganj" },
  { id: "Ghior", name: "Ghior", districtId: "Manikganj" },
  { id: "Harirampur", name: "Harirampur", districtId: "Manikganj" },
  { id: "Manikganj Sadar", name: "Manikganj Sadar", districtId: "Manikganj" },
  { id: "Saturia", name: "Saturia", districtId: "Manikganj" },
  { id: "Shibalaya", name: "Shibalaya", districtId: "Manikganj" },
  { id: "Singair", name: "Singair", districtId: "Manikganj" },

  // Maulavibazar District
  { id: "Barlekha", name: "Barlekha", districtId: "Maulavibazar" },
  { id: "Juri", name: "Juri", districtId: "Maulavibazar" },
  { id: "Kamalganj", name: "Kamalganj", districtId: "Maulavibazar" },
  { id: "Kulaura", name: "Kulaura", districtId: "Maulavibazar" },
  {
    id: "Maulvi Bazar Sadar",
    name: "Maulvi Bazar Sadar",
    districtId: "Maulavibazar",
  },
  { id: "Rajnagar", name: "Rajnagar", districtId: "Maulavibazar" },
  { id: "Sreemangal", name: "Sreemangal", districtId: "Maulavibazar" },

  // Meherpur District
  { id: "Gangni", name: "Gangni", districtId: "Meherpur" },
  { id: "Meherpur Sadar", name: "Meherpur Sadar", districtId: "Meherpur" },
  { id: "Mujibnagar", name: "Mujibnagar", districtId: "Meherpur" },

  // Munshiganj District
  { id: "Gazaria", name: "Gazaria", districtId: "Munshiganj" },
  { id: "Lohajang", name: "Lohajang", districtId: "Munshiganj" },
  {
    id: "Munshiganj Sadar",
    name: "Munshiganj Sadar",
    districtId: "Munshiganj",
  },
  { id: "Sirajdikhan", name: "Sirajdikhan", districtId: "Munshiganj" },
  { id: "Sreenagar", name: "Sreenagar", districtId: "Munshiganj" },
  { id: "Tongibari", name: "Tongibari", districtId: "Munshiganj" },

  // Mymensingh District
  { id: "Bhaluka", name: "Bhaluka", districtId: "Mymensingh" },
  { id: "Dhobaura", name: "Dhobaura", districtId: "Mymensingh" },
  { id: "Fulbaria", name: "Fulbaria", districtId: "Mymensingh" },
  { id: "Gaffargaon", name: "Gaffargaon", districtId: "Mymensingh" },
  { id: "Gouripur", name: "Gouripur", districtId: "Mymensingh" },
  { id: "Haluaghat", name: "Haluaghat", districtId: "Mymensingh" },
  { id: "Ishwarganj", name: "Ishwarganj", districtId: "Mymensingh" },
  { id: "Muktagachha", name: "Muktagachha", districtId: "Mymensingh" },
  {
    id: "Mymensingh Sadar",
    name: "Mymensingh Sadar",
    districtId: "Mymensingh",
  },
  { id: "Nandail", name: "Nandail", districtId: "Mymensingh" },
  { id: "Phulpur", name: "Phulpur", districtId: "Mymensingh" },
  { id: "Sapahar", name: "Sapahar", districtId: "Mymensingh" },
  { id: "Trishal", name: "Trishal", districtId: "Mymensingh" },

  // Naogaon District
  { id: "Atrai", name: "Atrai", districtId: "Naogaon" },
  { id: "Badalgachhi", name: "Badalgachhi", districtId: "Naogaon" },
  { id: "Dhamoirhat", name: "Dhamoirhat", districtId: "Naogaon" },
  { id: "Mahadebpur", name: "Mahadebpur", districtId: "Naogaon" },
  { id: "Manda", name: "Manda", districtId: "Naogaon" },
  { id: "Naogaon Sadar", name: "Naogaon Sadar", districtId: "Naogaon" },
  { id: "Niamatpur", name: "Niamatpur", districtId: "Naogaon" },
  { id: "Patnitala", name: "Patnitala", districtId: "Naogaon" },
  { id: "Porsha", name: "Porsha", districtId: "Naogaon" },
  { id: "Raninagar", name: "Raninagar", districtId: "Naogaon" },

  // Narail District
  { id: "Kalia", name: "Kalia", districtId: "Narail" },
  { id: "Lohagara", name: "Lohagara", districtId: "Narail" },
  { id: "Narail Sadar", name: "Narail Sadar", districtId: "Narail" },

  // Narayanganj District
  { id: "Araihazar", name: "Araihazar", districtId: "Narayanganj" },
  { id: "Bandar", name: "Bandar", districtId: "Narayanganj" },
  {
    id: "Narayanganj Sadar",
    name: "Narayanganj Sadar",
    districtId: "Narayanganj",
  },
  { id: "Rupganj", name: "Rupganj", districtId: "Narayanganj" },
  { id: "Sonargaon", name: "Sonargaon", districtId: "Narayanganj" },

  // Narsingdi District
  { id: "Belabo", name: "Belabo", districtId: "Narsingdi" },
  { id: "Manohardi", name: "Manohardi", districtId: "Narsingdi" },
  { id: "Narsingdi Sadar", name: "Narsingdi Sadar", districtId: "Narsingdi" },
  { id: "Palash", name: "Palash", districtId: "Narsingdi" },
  { id: "Raipura", name: "Raipura", districtId: "Narsingdi" },
  { id: "Shibpur", name: "Shibpur", districtId: "Narsingdi" },

  // Natore District
  { id: "Bagatipara", name: "Bagatipara", districtId: "Natore" },
  { id: "Baraigram", name: "Baraigram", districtId: "Natore" },
  { id: "Gurudaspur", name: "Gurudaspur", districtId: "Natore" },
  { id: "Lalpur", name: "Lalpur", districtId: "Natore" },
  { id: "Naldanga", name: "Naldanga", districtId: "Natore" },
  { id: "Natore Sadar", name: "Natore Sadar", districtId: "Natore" },
  { id: "Singra", name: "Singra", districtId: "Natore" },

  // Netrakona District
  { id: "Atpara", name: "Atpara", districtId: "Netrakona" },
  { id: "Barhatta", name: "Barhatta", districtId: "Netrakona" },
  { id: "Durgapur", name: "Durgapur", districtId: "Netrakona" },
  { id: "Kalmakanda", name: "Kalmakanda", districtId: "Netrakona" },
  { id: "Kendua", name: "Kendua", districtId: "Netrakona" },
  { id: "Khaliajuri", name: "Khaliajuri", districtId: "Netrakona" },
  { id: "Madan", name: "Madan", districtId: "Netrakona" },
  { id: "Mohanganj", name: "Mohanganj", districtId: "Netrakona" },
  { id: "Netrakona Sadar", name: "Netrakona Sadar", districtId: "Netrakona" },
  { id: "Purbadhala", name: "Purbadhala", districtId: "Netrakona" },

  // Nilphamari District
  { id: "Dimla", name: "Dimla", districtId: "Nilphamari" },
  { id: "Domar", name: "Domar", districtId: "Nilphamari" },
  { id: "Jaldhaka", name: "Jaldhaka", districtId: "Nilphamari" },
  { id: "Kishoreganj", name: "Kishoreganj", districtId: "Nilphamari" },
  {
    id: "Nilphamari Sadar",
    name: "Nilphamari Sadar",
    districtId: "Nilphamari",
  },
  { id: "Saidpur", name: "Saidpur", districtId: "Nilphamari" },

  // Noakhali District
  { id: "Begumganj", name: "Begumganj", districtId: "Noakhali" },
  { id: "Chatkhil", name: "Chatkhil", districtId: "Noakhali" },
  { id: "Companiganj", name: "Companiganj", districtId: "Noakhali" },
  { id: "Hatiya", name: "Hatiya", districtId: "Noakhali" },
  { id: "Kabirhat", name: "Kabirhat", districtId: "Noakhali" },
  { id: "Noakhali Sadar", name: "Noakhali Sadar", districtId: "Noakhali" },
  { id: "Senbagh", name: "Senbagh", districtId: "Noakhali" },
  { id: "Sonaimuri", name: "Sonaimuri", districtId: "Noakhali" },
  { id: "Subarnachar", name: "Subarnachar", districtId: "Noakhali" },

  // Pabna District
  { id: "Atgharia", name: "Atgharia", districtId: "Pabna" },
  { id: "Bera", name: "Bera", districtId: "Pabna" },
  { id: "Bhangura", name: "Bhangura", districtId: "Pabna" },
  { id: "Chatmohar", name: "Chatmohar", districtId: "Pabna" },
  { id: "Faridpur", name: "Faridpur", districtId: "Pabna" },
  { id: "Ishwardi", name: "Ishwardi", districtId: "Pabna" },
  { id: "Pabna Sadar", name: "Pabna Sadar", districtId: "Pabna" },
  { id: "Santhia", name: "Santhia", districtId: "Pabna" },
  { id: "Sujanagar", name: "Sujanagar", districtId: "Pabna" },

  // Panchagarh District
  { id: "Atwari", name: "Atwari", districtId: "Panchagarh" },
  { id: "Boda", name: "Boda", districtId: "Panchagarh" },
  { id: "Debiganj", name: "Debiganj", districtId: "Panchagarh" },
  {
    id: "Panchagarh Sadar",
    name: "Panchagarh Sadar",
    districtId: "Panchagarh",
  },
  { id: "Tetulia", name: "Tetulia", districtId: "Panchagarh" },

  // Patuakhali District
  { id: "Bauphal", name: "Bauphal", districtId: "Patuakhali" },
  { id: "Dashmina", name: "Dashmina", districtId: "Patuakhali" },
  { id: "Dumki", name: "Dumki", districtId: "Patuakhali" },
  { id: "Galachipa", name: "Galachipa", districtId: "Patuakhali" },
  { id: "Kalapara", name: "Kalapara", districtId: "Patuakhali" },
  { id: "Mirzaganj", name: "Mirzaganj", districtId: "Patuakhali" },
  {
    id: "Patuakhali Sadar",
    name: "Patuakhali Sadar",
    districtId: "Patuakhali",
  },

  // Pirojpur District
  { id: "Bhandaria", name: "Bhandaria", districtId: "Pirojpur" },
  { id: "Kawkhali", name: "Kawkhali", districtId: "Pirojpur" },
  { id: "Mathbaria", name: "Mathbaria", districtId: "Pirojpur" },
  { id: "Nazirpur", name: "Nazirpur", districtId: "Pirojpur" },
  { id: "Nesarabad", name: "Nesarabad", districtId: "Pirojpur" },
  { id: "Pirojpur Sadar", name: "Pirojpur Sadar", districtId: "Pirojpur" },
  { id: "Zianagar", name: "Zianagar", districtId: "Pirojpur" },

  // Rajbari District
  { id: "Baliakandi", name: "Baliakandi", districtId: "Rajbari" },
  { id: "Goalanda", name: "Goalanda", districtId: "Rajbari" },
  { id: "Kalukhali", name: "Kalukhali", districtId: "Rajbari" },
  { id: "Pangsha", name: "Pangsha", districtId: "Rajbari" },
  { id: "Rajbari Sadar", name: "Rajbari Sadar", districtId: "Rajbari" },

  // Rajshahi District
  { id: "Bagha", name: "Bagha", districtId: "Rajshahi" },
  { id: "Baghmara", name: "Baghmara", districtId: "Rajshahi" },
  { id: "Boalia", name: "Boalia", districtId: "Rajshahi" },
  { id: "Charghat", name: "Charghat", districtId: "Rajshahi" },
  { id: "Durgapur", name: "Durgapur", districtId: "Rajshahi" },
  { id: "Godagari", name: "Godagari", districtId: "Rajshahi" },
  { id: "Matihar", name: "Matihar", districtId: "Rajshahi" },
  { id: "Mohanpur", name: "Mohanpur", districtId: "Rajshahi" },
  { id: "Paba", name: "Paba", districtId: "Rajshahi" },
  { id: "Puthia", name: "Puthia", districtId: "Rajshahi" },
  { id: "Rajpara", name: "Rajpara", districtId: "Rajshahi" },
  { id: "Shah Makhdam", name: "Shah Makhdam", districtId: "Rajshahi" },
  { id: "Tanore", name: "Tanore", districtId: "Rajshahi" },

  // Rangamati District
  { id: "Baghaichhari", name: "Baghaichhari", districtId: "Rangamati" },
  { id: "Barkal", name: "Barkal", districtId: "Rangamati" },
  { id: "Belaichhari", name: "Belaichhari", districtId: "Rangamati" },
  { id: "Juraichhari", name: "Juraichhari", districtId: "Rangamati" },
  { id: "Kaptai", name: "Kaptai", districtId: "Rangamati" },
  { id: "Kawkhali", name: "Kawkhali", districtId: "Rangamati" },
  { id: "Langadu", name: "Langadu", districtId: "Rangamati" },
  { id: "Naniarchar", name: "Naniarchar", districtId: "Rangamati" },
  { id: "Rajasthali", name: "Rajasthali", districtId: "Rangamati" },
  { id: "Rangamati Sadar", name: "Rangamati Sadar", districtId: "Rangamati" },

  // Rangpur District
  { id: "Badarganj", name: "Badarganj", districtId: "Rangpur" },
  { id: "Gangachara", name: "Gangachara", districtId: "Rangpur" },
  { id: "Kaunia", name: "Kaunia", districtId: "Rangpur" },
  { id: "Mithapukur", name: "Mithapukur", districtId: "Rangpur" },
  { id: "Pirgachha", name: "Pirgachha", districtId: "Rangpur" },
  { id: "Pirganj", name: "Pirganj", districtId: "Rangpur" },
  { id: "Rangpur Sadar", name: "Rangpur Sadar", districtId: "Rangpur" },
  { id: "Taraganj", name: "Taraganj", districtId: "Rangpur" },

  // Satkhira District
  { id: "Assasuni", name: "Assasuni", districtId: "Satkhira" },
  { id: "Debhata", name: "Debhata", districtId: "Satkhira" },
  { id: "Kalaroa", name: "Kalaroa", districtId: "Satkhira" },
  { id: "Kaliganj", name: "Kaliganj", districtId: "Satkhira" },
  { id: "Satkhira Sadar", name: "Satkhira Sadar", districtId: "Satkhira" },
  { id: "Shyamnagar", name: "Shyamnagar", districtId: "Satkhira" },
  { id: "Tala", name: "Tala", districtId: "Satkhira" },

  // Shariatpur District
  { id: "Bhedarganj", name: "Bhedarganj", districtId: "Shariatpur" },
  { id: "Damudya", name: "Damudya", districtId: "Shariatpur" },
  { id: "Gosairhat", name: "Gosairhat", districtId: "Shariatpur" },
  { id: "Naria", name: "Naria", districtId: "Shariatpur" },
  {
    id: "Shariatpur Sadar",
    name: "Shariatpur Sadar",
    districtId: "Shariatpur",
  },
  { id: "Zajira", name: "Zajira", districtId: "Shariatpur" },

  // Sherpur District
  { id: "Jhenaigati", name: "Jhenaigati", districtId: "Sherpur" },
  { id: "Nakla", name: "Nakla", districtId: "Sherpur" },
  { id: "Nalitabari", name: "Nalitabari", districtId: "Sherpur" },
  { id: "Sherpur Sadar", name: "Sherpur Sadar", districtId: "Sherpur" },
  { id: "Sreebardi", name: "Sreebardi", districtId: "Sherpur" },

  // Sirajganj District
  { id: "Belkuchi", name: "Belkuchi", districtId: "Sirajganj" },
  { id: "Chauhali", name: "Chauhali", districtId: "Sirajganj" },
  { id: "Kamarkhanda", name: "Kamarkhanda", districtId: "Sirajganj" },
  { id: "Kazipur", name: "Kazipur", districtId: "Sirajganj" },
  { id: "Raiganj", name: "Raiganj", districtId: "Sirajganj" },
  { id: "Shahjadpur", name: "Shahjadpur", districtId: "Sirajganj" },
  { id: "Sirajganj Sadar", name: "Sirajganj Sadar", districtId: "Sirajganj" },
  { id: "Tarash", name: "Tarash", districtId: "Sirajganj" },
  { id: "Ullahpara", name: "Ullahpara", districtId: "Sirajganj" },

  // Sunamganj District
  { id: "Bishwambarpur", name: "Bishwambarpur", districtId: "Sunamganj" },
  { id: "Chhatak", name: "Chhatak", districtId: "Sunamganj" },
  { id: "Derai", name: "Derai", districtId: "Sunamganj" },
  { id: "Dowarabazar", name: "Dowarabazar", districtId: "Sunamganj" },
  { id: "Jagannathpur", name: "Jagannathpur", districtId: "Sunamganj" },
  { id: "Jamalganj", name: "Jamalganj", districtId: "Sunamganj" },
  { id: "Madhyanagar", name: "Madhyanagar", districtId: "Sunamganj" },
  { id: "Shantiganj", name: "Shantiganj", districtId: "Sunamganj" },
  { id: "Shalla", name: "Shalla", districtId: "Sunamganj" },
  { id: "Sunamganj Sadar", name: "Sunamganj Sadar", districtId: "Sunamganj" },
  { id: "Tahirpur", name: "Tahirpur", districtId: "Sunamganj" },

  // Sylhet District - Updated with complete list
  { id: "Balaganj", name: "Balaganj", districtId: "Sylhet" },
  { id: "Beani Bazar", name: "Beani Bazar", districtId: "Sylhet" },
  { id: "Bishwanath", name: "Bishwanath", districtId: "Sylhet" },
  { id: "Companiganj", name: "Companiganj", districtId: "Sylhet" },
  { id: "Dakshin Surma", name: "Dakshin Surma", districtId: "Sylhet" },
  { id: "Fenchuganj", name: "Fenchuganj", districtId: "Sylhet" },
  { id: "Golapganj", name: "Golapganj", districtId: "Sylhet" },
  { id: "Gowainghat", name: "Gowainghat", districtId: "Sylhet" },
  { id: "Jaintiapur", name: "Jaintiapur", districtId: "Sylhet" },
  { id: "Kanaighat", name: "Kanaighat", districtId: "Sylhet" },
  { id: "Sylhet Sadar", name: "Sylhet Sadar", districtId: "Sylhet" },
  { id: "Zakiganj", name: "Zakiganj", districtId: "Sylhet" },

  // Tangail District
  { id: "Basail", name: "Basail", districtId: "Tangail" },
  { id: "Bhuapur", name: "Bhuapur", districtId: "Tangail" },
  { id: "Delduar", name: "Delduar", districtId: "Tangail" },
  { id: "Dhanbari", name: "Dhanbari", districtId: "Tangail" },
  { id: "Ghatail", name: "Ghatail", districtId: "Tangail" },
  { id: "Gopalpur", name: "Gopalpur", districtId: "Tangail" },
  { id: "Kalihati", name: "Kalihati", districtId: "Tangail" },
  { id: "Madhupur", name: "Madhupur", districtId: "Tangail" },
  { id: "Mirzapur", name: "Mirzapur", districtId: "Tangail" },
  { id: "Nagarpur", name: "Nagarpur", districtId: "Tangail" },
  { id: "Sakhipur", name: "Sakhipur", districtId: "Tangail" },
  { id: "Tangail Sadar", name: "Tangail Sadar", districtId: "Tangail" },

  // Thakurgaon District
  { id: "Baliadangi", name: "Baliadangi", districtId: "Thakurgaon" },
  { id: "Haripur", name: "Haripur", districtId: "Thakurgaon" },
  { id: "Pirganj", name: "Pirganj", districtId: "Thakurgaon" },
  { id: "Ranisankail", name: "Ranisankail", districtId: "Thakurgaon" },

  // Add more upazilas as needed for other districts
];

export const getDistricts = (): District[] => {
  return districts;
};

export const getUpazilasByDistrict = (districtId: string): Upazila[] => {
  return upazilas.filter((upazila) => upazila.districtId === districtId);
};

export const getDistrictById = (id: string): District | undefined => {
  return districts.find((district) => district.id === id);
};

export const getUpazilaById = (id: string): Upazila | undefined => {
  return upazilas.find((upazila) => upazila.id === id);
};
