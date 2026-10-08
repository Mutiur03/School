export interface Upazila {
  id: string;
  name: string;
  bn: string;
  districtId: string;
}

export interface District {
  id: string;
  name: string;
  bn: string;
}

export const districts: District[] = [
  { id: 'Joypurhat', name: 'Joypurhat', bn: 'জয়পুরহাট' },
  { id: 'Bagerhat', name: 'Bagerhat', bn: 'বাগেরহাট' },
  { id: 'Bandarban', name: 'Bandarban', bn: 'বান্দরবান' },
  { id: 'Barguna', name: 'Barguna', bn: 'বরগুনা' },
  { id: 'Barisal', name: 'Barisal', bn: 'বরিশাল' },
  { id: 'Bhola', name: 'Bhola', bn: 'ভোলা' },
  { id: 'Bogura', name: 'Bogura', bn: 'বগুড়া' },
  { id: 'Brahmanbaria', name: 'Brahmanbaria', bn: 'ব্রাহ্মণবাড়িয়া' },
  { id: 'Chandpur', name: 'Chandpur', bn: 'চাঁদপুর' },
  { id: 'Chapainawabganj', name: 'Chapainawabganj', bn: 'চাঁপাইনবাবগঞ্জ' },
  { id: 'Chattogram', name: 'Chattogram', bn: 'চট্টগ্রাম' },
  { id: 'Chuadanga', name: 'Chuadanga', bn: 'চুয়াডাঙ্গা' },
  { id: 'Coxsbazar', name: 'Coxsbazar', bn: 'কক্সবাজার' },
  { id: 'Cumilla', name: 'Cumilla', bn: 'কুমিল্লা' },
  { id: 'Dhaka', name: 'Dhaka', bn: 'ঢাকা' },
  { id: 'Dinajpur', name: 'Dinajpur', bn: 'দিনাজপুর' },
  { id: 'Faridpur', name: 'Faridpur', bn: 'ফরিদপুর' },
  { id: 'Feni', name: 'Feni', bn: 'ফেনী' },
  { id: 'Gaibandha', name: 'Gaibandha', bn: 'গাইবান্ধা' },
  { id: 'Gazipur', name: 'Gazipur', bn: 'গাজীপুর' },
  { id: 'Gopalganj', name: 'Gopalganj', bn: 'গোপালগঞ্জ' },
  { id: 'Habiganj', name: 'Habiganj', bn: 'হবিগঞ্জ' },
  { id: 'Jamalpur', name: 'Jamalpur', bn: 'জামালপুর' },
  { id: 'Jashore', name: 'Jashore', bn: 'যশোর' },
  { id: 'Jhalakati', name: 'Jhalakati', bn: 'ঝালকাঠি' },
  { id: 'Jhenaidah', name: 'Jhenaidah', bn: 'ঝিনাইদহ' },
  { id: 'Khagrachhari', name: 'Khagrachhari', bn: 'খাগড়াছড়ি' },
  { id: 'Khulna', name: 'Khulna', bn: 'খুলনা' },
  { id: 'Kishoreganj', name: 'Kishoreganj', bn: 'কিশোরগঞ্জ' },
  { id: 'Kurigram', name: 'Kurigram', bn: 'কুড়িগ্রাম' },
  { id: 'Kushtia', name: 'Kushtia', bn: 'কুষ্টিয়া' },
  { id: 'Lakshmipur', name: 'Lakshmipur', bn: 'লক্ষ্মীপুর' },
  { id: 'Lalmonirhat', name: 'Lalmonirhat', bn: 'লালমনিরহাট' },
  { id: 'Madaripur', name: 'Madaripur', bn: 'মাদারীপুর' },
  { id: 'Magura', name: 'Magura', bn: 'মাগুরা' },
  { id: 'Manikganj', name: 'Manikganj', bn: 'মানিকগঞ্জ' },
  { id: 'Maulavibazar', name: 'Maulavibazar', bn: 'মৌলভীবাজার' },
  { id: 'Meherpur', name: 'Meherpur', bn: 'মেহেরপুর' },
  { id: 'Munshiganj', name: 'Munshiganj', bn: 'মুন্সীগঞ্জ' },
  { id: 'Mymensingh', name: 'Mymensingh', bn: 'ময়মনসিংহ' },
  { id: 'Naogaon', name: 'Naogaon', bn: 'নওগাঁ' },
  { id: 'Narail', name: 'Narail', bn: 'নড়াইল' },
  { id: 'Narayanganj', name: 'Narayanganj', bn: 'নারায়ণগঞ্জ' },
  { id: 'Narsingdi', name: 'Narsingdi', bn: 'নরসিংদী' },
  { id: 'Natore', name: 'Natore', bn: 'নাটোর' },
  { id: 'Netrakona', name: 'Netrakona', bn: 'নেত্রকোণা' },
  { id: 'Nilphamari', name: 'Nilphamari', bn: 'নীলফামারী' },
  { id: 'Noakhali', name: 'Noakhali', bn: 'নোয়াখালী' },
  { id: 'Pabna', name: 'Pabna', bn: 'পাবনা' },
  { id: 'Panchagarh', name: 'Panchagarh', bn: 'পঞ্চগড়' },
  { id: 'Patuakhali', name: 'Patuakhali', bn: 'পটুয়াখালী' },
  { id: 'Pirojpur', name: 'Pirojpur', bn: 'পিরোজপুর' },
  { id: 'Rajbari', name: 'Rajbari', bn: 'রাজবাড়ী' },
  { id: 'Rajshahi', name: 'Rajshahi', bn: 'রাজশাহী' },
  { id: 'Rangamati', name: 'Rangamati', bn: 'রাঙ্গামাটি' },
  { id: 'Rangpur', name: 'Rangpur', bn: 'রংপুর' },
  { id: 'Satkhira', name: 'Satkhira', bn: 'সাতক্ষীরা' },
  { id: 'Shariatpur', name: 'Shariatpur', bn: 'শরীয়তপুর' },
  { id: 'Sherpur', name: 'Sherpur', bn: 'শেরপুর' },
  { id: 'Sirajganj', name: 'Sirajganj', bn: 'সিরাজগঞ্জ' },
  { id: 'Sunamganj', name: 'Sunamganj', bn: 'সুনামগঞ্জ' },
  { id: 'Sylhet', name: 'Sylhet', bn: 'সিলেট' },
  { id: 'Tangail', name: 'Tangail', bn: 'টাঙ্গাইল' },
  { id: 'Thakurgaon', name: 'Thakurgaon', bn: 'ঠাকুরগাঁও' },
];

export const upazilas: Upazila[] = [
  // Bagerhat District
  { id: 'Bagerhat Sadar', name: 'Bagerhat Sadar', bn: 'বাগেরহাট সদর', districtId: 'Bagerhat' },
  { id: 'Chitalmari', name: 'Chitalmari', bn: 'চিতলমারী', districtId: 'Bagerhat' },
  { id: 'Fakirhat', name: 'Fakirhat', bn: 'ফকিরহাট', districtId: 'Bagerhat' },
  { id: 'Kachua', name: 'Kachua', bn: 'কচুয়া', districtId: 'Bagerhat' },
  { id: 'Mollahat', name: 'Mollahat', bn: 'মোল্লাহাট', districtId: 'Bagerhat' },
  { id: 'Mongla', name: 'Mongla', bn: 'মোংলা', districtId: 'Bagerhat' },
  { id: 'Morrelganj', name: 'Morrelganj', bn: 'মোড়েলগঞ্জ', districtId: 'Bagerhat' },
  { id: 'Rampal', name: 'Rampal', bn: 'রামপাল', districtId: 'Bagerhat' },
  { id: 'Sharankhola', name: 'Sharankhola', bn: 'শরণখোলা', districtId: 'Bagerhat' },

  // Bandarban District
  { id: 'Alikadam', name: 'Alikadam', bn: 'আলীকদম', districtId: 'Bandarban' },
  { id: 'Bandarban Sadar', name: 'Bandarban Sadar', bn: 'বান্দরবান সদর', districtId: 'Bandarban' },
  { id: 'Lama', name: 'Lama', bn: 'লামা', districtId: 'Bandarban' },
  { id: 'Naikhongchhari', name: 'Naikhongchhari', bn: 'নাইক্ষ্যংছড়ি', districtId: 'Bandarban' },
  { id: 'Rowangchhari', name: 'Rowangchhari', bn: 'রোয়াংছড়ি', districtId: 'Bandarban' },
  { id: 'Ruma', name: 'Ruma', bn: 'রুমা', districtId: 'Bandarban' },
  { id: 'Thanchi', name: 'Thanchi', bn: 'থানচি', districtId: 'Bandarban' },

  // Barguna District
  { id: 'Amtali', name: 'Amtali', bn: 'আমতলী', districtId: 'Barguna' },
  { id: 'Bamna', name: 'Bamna', bn: 'বামনা', districtId: 'Barguna' },
  { id: 'Barguna Sadar', name: 'Barguna Sadar', bn: 'বরগুনা সদর', districtId: 'Barguna' },
  { id: 'Betagi', name: 'Betagi', bn: 'বেতাগী', districtId: 'Barguna' },
  { id: 'Patharghata', name: 'Patharghata', bn: 'পাথরঘাটা', districtId: 'Barguna' },

  // Barisal District
  { id: 'Agailjhara', name: 'Agailjhara', bn: 'আগৈলঝাড়া', districtId: 'Barisal' },
  { id: 'Babuganj', name: 'Babuganj', bn: 'বাবুগঞ্জ', districtId: 'Barisal' },
  { id: 'Bakerganj', name: 'Bakerganj', bn: 'বাকেরগঞ্জ', districtId: 'Barisal' },
  { id: 'Banaripara', name: 'Banaripara', bn: 'বানারীপাড়া', districtId: 'Barisal' },
  { id: 'Barisal Sadar', name: 'Barisal Sadar', bn: 'বরিশাল সদর', districtId: 'Barisal' },
  { id: 'Gaurnadi', name: 'Gaurnadi', bn: 'গৌরনদী', districtId: 'Barisal' },
  { id: 'Hizla', name: 'Hizla', bn: 'হিজলা', districtId: 'Barisal' },
  { id: 'Mehendiganj', name: 'Mehendiganj', bn: 'মেহেন্দিগঞ্জ', districtId: 'Barisal' },
  { id: 'Muladi', name: 'Muladi', bn: 'মুলাদী', districtId: 'Barisal' },
  { id: 'Wazirpur', name: 'Wazirpur', bn: 'উজিরপুর', districtId: 'Barisal' },

  // Bhola District
  { id: 'Bhola Sadar', name: 'Bhola Sadar', bn: 'ভোলা সদর', districtId: 'Bhola' },
  { id: 'Burhanuddin', name: 'Burhanuddin', bn: 'বোরহানউদ্দিন', districtId: 'Bhola' },
  { id: 'Char Fasson', name: 'Char Fasson', bn: 'চরফ্যাশন', districtId: 'Bhola' },
  { id: 'Daulatkhan', name: 'Daulatkhan', bn: 'দৌলতখান', districtId: 'Bhola' },
  { id: 'Lalmohan', name: 'Lalmohan', bn: 'লালমোহন', districtId: 'Bhola' },
  { id: 'Manpura', name: 'Manpura', bn: 'মনপুরা', districtId: 'Bhola' },
  { id: 'Tazumuddin', name: 'Tazumuddin', bn: 'তজুমদ্দিন', districtId: 'Bhola' },

  // Bogura District
  { id: 'Adamdighi', name: 'Adamdighi', bn: 'আদমদীঘি', districtId: 'Bogura' },
  { id: 'Bogura Sadar', name: 'Bogura Sadar', bn: 'বগুড়া সদর', districtId: 'Bogura' },
  { id: 'Dhunat', name: 'Dhunat', bn: 'ধুনট', districtId: 'Bogura' },
  { id: 'Dupchanchia', name: 'Dupchanchia', bn: 'দুপচাঁচিয়া', districtId: 'Bogura' },
  { id: 'Gabtali', name: 'Gabtali', bn: 'গাবতলী', districtId: 'Bogura' },
  { id: 'Mokamtola', name: 'Mokamtola', bn: 'মোকামতলা', districtId: 'Bogura' },
  { id: 'Kahaloo', name: 'Kahaloo', bn: 'কাহালু', districtId: 'Bogura' },
  { id: 'Nandigram', name: 'Nandigram', bn: 'নন্দীগ্রাম', districtId: 'Bogura' },
  { id: 'Sariakandi', name: 'Sariakandi', bn: 'সারিয়াকান্দি', districtId: 'Bogura' },
  { id: 'Shajahanpur', name: 'Shajahanpur', bn: 'শাজাহানপুর', districtId: 'Bogura' },
  { id: 'Sherpur', name: 'Sherpur', bn: 'শেরপুর', districtId: 'Bogura' },
  { id: 'Shibganj', name: 'Shibganj', bn: 'শিবগঞ্জ', districtId: 'Bogura' },
  { id: 'Sonatala', name: 'Sonatala', bn: 'সোনাতলা', districtId: 'Bogura' },

  // Brahmanbaria District
  { id: 'Akhaura', name: 'Akhaura', bn: 'আখাউড়া', districtId: 'Brahmanbaria' },
  { id: 'Ashuganj', name: 'Ashuganj', bn: 'আশুগঞ্জ', districtId: 'Brahmanbaria' },
  { id: 'Bancharampur', name: 'Bancharampur', bn: 'বাঞ্ছারামপুর', districtId: 'Brahmanbaria' },
  { id: 'Bijoynagar', name: 'Bijoynagar', bn: 'বিজয়নগর', districtId: 'Brahmanbaria' },
  {
    id: 'Brahmanbaria Sadar',
    name: 'Brahmanbaria Sadar',
    bn: 'ব্রাহ্মণবাড়িয়া সদর',
    districtId: 'Brahmanbaria',
  },
  { id: 'Kasba', name: 'Kasba', bn: 'কসবা', districtId: 'Brahmanbaria' },
  { id: 'Nabinagar', name: 'Nabinagar', bn: 'নবীনগর', districtId: 'Brahmanbaria' },
  { id: 'Nasirnagar', name: 'Nasirnagar', bn: 'নাসিরনগর', districtId: 'Brahmanbaria' },
  { id: 'Sarail', name: 'Sarail', bn: 'সরাইল', districtId: 'Brahmanbaria' },

  // Chandpur District
  { id: 'Chandpur Sadar', name: 'Chandpur Sadar', bn: 'চাঁদপুর সদর', districtId: 'Chandpur' },
  { id: 'Faridganj', name: 'Faridganj', bn: 'ফরিদগঞ্জ', districtId: 'Chandpur' },
  { id: 'Haimchar', name: 'Haimchar', bn: 'হাইমচর', districtId: 'Chandpur' },
  { id: 'Hajiganj', name: 'Hajiganj', bn: 'হাজীগঞ্জ', districtId: 'Chandpur' },
  { id: 'Kachua', name: 'Kachua', bn: 'কচুয়া', districtId: 'Chandpur' },
  { id: 'Matlab Dakshin', name: 'Matlab Dakshin', bn: 'মতলব দক্ষিণ', districtId: 'Chandpur' },
  { id: 'Matlab Uttar', name: 'Matlab Uttar', bn: 'মতলব উত্তর', districtId: 'Chandpur' },
  { id: 'Shahrasti', name: 'Shahrasti', bn: 'শাহরাস্তি', districtId: 'Chandpur' },

  // Chapainawabganj District
  { id: 'Bholahat', name: 'Bholahat', bn: 'ভোলাহাট', districtId: 'Chapainawabganj' },
  {
    id: 'Chapai Nawabganj Sadar',
    name: 'Chapai Nawabganj Sadar',
    bn: 'চাঁপাইনবাবগঞ্জ সদর',
    districtId: 'Chapainawabganj',
  },
  { id: 'Gomastapur', name: 'Gomastapur', bn: 'গোমস্তাপুর', districtId: 'Chapainawabganj' },
  { id: 'Nachole', name: 'Nachole', bn: 'নাচোল', districtId: 'Chapainawabganj' },
  { id: 'Shibganj', name: 'Shibganj', bn: 'শিবগঞ্জ', districtId: 'Chapainawabganj' },

  // Dhaka District
  { id: 'Dhanmondi', name: 'Dhanmondi', bn: 'ধানমন্ডি', districtId: 'Dhaka' },
  { id: 'Gulshan', name: 'Gulshan', bn: 'গুলশান', districtId: 'Dhaka' },
  { id: 'Uttara', name: 'Uttara', bn: 'উত্তরা', districtId: 'Dhaka' },
  { id: 'Mirpur', name: 'Mirpur', bn: 'মিরপুর', districtId: 'Dhaka' },
  { id: 'Tejgaon', name: 'Tejgaon', bn: 'তেজগাঁও', districtId: 'Dhaka' },
  { id: 'Ramna', name: 'Ramna', bn: 'রমনা', districtId: 'Dhaka' },

  // Chattogram District - Updated with complete list
  { id: 'Anowara', name: 'Anowara', bn: 'আনোয়ারা', districtId: 'Chattogram' },
  { id: 'Bakalia', name: 'Bakalia', bn: 'বাকলিয়া', districtId: 'Chattogram' },
  { id: 'Bandar', name: 'Bandar', bn: 'বন্দর', districtId: 'Chattogram' },
  { id: 'Banshkhali', name: 'Banshkhali', bn: 'বাঁশখালী', districtId: 'Chattogram' },
  { id: 'Bayejid', name: 'Bayejid', bn: 'বায়েজিদ', districtId: 'Chattogram' },
  { id: 'Boalkhali', name: 'Boalkhali', bn: 'বোয়ালখালী', districtId: 'Chattogram' },
  { id: 'Chandanaish', name: 'Chandanaish', bn: 'চন্দনাইশ', districtId: 'Chattogram' },
  { id: 'Chandgaon', name: 'Chandgaon', bn: 'চান্দগাঁও', districtId: 'Chattogram' },
  { id: 'Double Mooring', name: 'Double Mooring', bn: 'ডবলমুরিং', districtId: 'Chattogram' },
  { id: 'Fatikchhari', name: 'Fatikchhari', bn: 'ফটিকছড়ি', districtId: 'Chattogram' },
  { id: 'Halishahar', name: 'Halishahar', bn: 'হালিশহর', districtId: 'Chattogram' },
  { id: 'Hathazari', name: 'Hathazari', bn: 'হাটহাজারী', districtId: 'Chattogram' },
  { id: 'Khulshi', name: 'Khulshi', bn: 'খুলশী', districtId: 'Chattogram' },
  { id: 'Kotwali', name: 'Kotwali', bn: 'কোতোয়ালী', districtId: 'Chattogram' },
  { id: 'Lohagara', name: 'Lohagara', bn: 'লোহাগাড়া', districtId: 'Chattogram' },
  { id: 'Mirsharai', name: 'Mirsharai', bn: 'মীরসরাই', districtId: 'Chattogram' },
  { id: 'Pahartali', name: 'Pahartali', bn: 'পাহাড়তলী', districtId: 'Chattogram' },
  { id: 'Panchlaish', name: 'Panchlaish', bn: 'পাঁচলাইশ', districtId: 'Chattogram' },
  { id: 'Patenga', name: 'Patenga', bn: 'পতেঙ্গা', districtId: 'Chattogram' },
  { id: 'Patiya', name: 'Patiya', bn: 'পটিয়া', districtId: 'Chattogram' },
  { id: 'Rangunia', name: 'Rangunia', bn: 'রাঙ্গুনিয়া', districtId: 'Chattogram' },
  { id: 'Raozan', name: 'Raozan', bn: 'রাউজান', districtId: 'Chattogram' },
  { id: 'SanABip', name: 'SanABip', bn: 'সন্দ্বীপ', districtId: 'Chattogram' },
  { id: 'Satkania', name: 'Satkania', bn: 'সাতকানিয়া', districtId: 'Chattogram' },
  { id: 'Sitakunda', name: 'Sitakunda', bn: 'সীতাকুণ্ড', districtId: 'Chattogram' },

  // Chuadanga District
  { id: 'Alamdanga', name: 'Alamdanga', bn: 'আলমডাঙ্গা', districtId: 'Chuadanga' },
  {
    id: 'Chuadanga Sadar',
    name: 'Chuadanga Sadar',
    bn: 'চুয়াডাঙ্গা সদর',
    districtId: 'Chuadanga',
  },
  { id: 'Damurhuda', name: 'Damurhuda', bn: 'দামুড়হুদা', districtId: 'Chuadanga' },
  { id: 'Jibannagar', name: 'Jibannagar', bn: 'জীবননগর', districtId: 'Chuadanga' },

  // Coxsbazar District
  { id: 'Chakaria', name: 'Chakaria', bn: 'চকরিয়া', districtId: 'Coxsbazar' },
  {
    id: "Cox's Bazar Sadar",
    name: "Cox's Bazar Sadar",
    bn: 'কক্সবাজার সদর',
    districtId: 'Coxsbazar',
  },
  { id: 'Eidgaon', name: 'Eidgaon', bn: 'ঈদগাঁও', districtId: 'Coxsbazar' },
  { id: 'Kutubdia', name: 'Kutubdia', bn: 'কুতুবদিয়া', districtId: 'Coxsbazar' },
  { id: 'Maheshkhali', name: 'Maheshkhali', bn: 'মহেশখালী', districtId: 'Coxsbazar' },
  { id: 'Pekua', name: 'Pekua', bn: 'পেকুয়া', districtId: 'Coxsbazar' },
  { id: 'Ramu', name: 'Ramu', bn: 'রামু', districtId: 'Coxsbazar' },
  { id: 'Teknaf', name: 'Teknaf', bn: 'টেকনাফ', districtId: 'Coxsbazar' },
  { id: 'Ukhia', name: 'Ukhia', bn: 'উখিয়া', districtId: 'Coxsbazar' },

  // Cumilla District
  { id: 'Barura', name: 'Barura', bn: 'বরুড়া', districtId: 'Cumilla' },
  { id: 'Brahmanpara', name: 'Brahmanpara', bn: 'ব্রাহ্মণপাড়া', districtId: 'Cumilla' },
  { id: 'Burichang', name: 'Burichang', bn: 'বুড়িচং', districtId: 'Cumilla' },
  { id: 'Chandina', name: 'Chandina', bn: 'চান্দিনা', districtId: 'Cumilla' },
  { id: 'Chauddagram', name: 'Chauddagram', bn: 'চৌদ্দগ্রাম', districtId: 'Cumilla' },
  {
    id: 'Comilla Adarsha Sadar',
    name: 'Comilla Adarsha Sadar',
    bn: 'কুমিল্লা আদর্শ সদর',
    districtId: 'Cumilla',
  },
  {
    id: 'Comilla Sadar Dakshin',
    name: 'Comilla Sadar Dakshin',
    bn: 'কুমিল্লা সদর দক্ষিণ',
    districtId: 'Cumilla',
  },
  { id: 'Daudkandi', name: 'Daudkandi', bn: 'দাউদকান্দি', districtId: 'Cumilla' },
  { id: 'Debidwar', name: 'Debidwar', bn: 'দেবীদ্বার', districtId: 'Cumilla' },
  { id: 'Homna', name: 'Homna', bn: 'হোমনা', districtId: 'Cumilla' },
  { id: 'Laksham', name: 'Laksham', bn: 'লাকসাম', districtId: 'Cumilla' },
  { id: 'Manoharganj', name: 'Manoharganj', bn: 'মনোহরগঞ্জ', districtId: 'Cumilla' },
  { id: 'Meghna', name: 'Meghna', bn: 'মেঘনা', districtId: 'Cumilla' },
  { id: 'Muradnagar', name: 'Muradnagar', bn: 'মুরাদনগর', districtId: 'Cumilla' },
  { id: 'Nangalkot', name: 'Nangalkot', bn: 'নাঙ্গলকোট', districtId: 'Cumilla' },
  { id: 'Titas', name: 'Titas', bn: 'তিতাস', districtId: 'Cumilla' },

  // Dhaka District - Updated with complete list
  { id: 'Adabor', name: 'Adabor', bn: 'আদাবর', districtId: 'Dhaka' },
  { id: 'Badda', name: 'Badda', bn: 'বাড্ডা', districtId: 'Dhaka' },
  { id: 'Bangshal', name: 'Bangshal', bn: 'বংশাল', districtId: 'Dhaka' },
  { id: 'Biman Bandar', name: 'Biman Bandar', bn: 'বিমানবন্দর', districtId: 'Dhaka' },
  { id: 'Cantonment', name: 'Cantonment', bn: 'ক্যান্টনমেন্ট', districtId: 'Dhaka' },
  { id: 'Chawkbazar', name: 'Chawkbazar', bn: 'চকবাজার', districtId: 'Dhaka' },
  { id: 'Dakshinkhan', name: 'Dakshinkhan', bn: 'দক্ষিণখান', districtId: 'Dhaka' },
  { id: 'Darus Salam', name: 'Darus Salam', bn: 'দারুস সালাম', districtId: 'Dhaka' },
  { id: 'Demra', name: 'Demra', bn: 'ডেমরা', districtId: 'Dhaka' },
  { id: 'Dhamrai', name: 'Dhamrai', bn: 'ধামরাই', districtId: 'Dhaka' },
  { id: 'Dhanmondi', name: 'Dhanmondi', bn: 'ধানমন্ডি', districtId: 'Dhaka' },
  { id: 'Dohar', name: 'Dohar', bn: 'দোহার', districtId: 'Dhaka' },
  { id: 'Gendaria', name: 'Gendaria', bn: 'গেন্ডারিয়া', districtId: 'Dhaka' },
  { id: 'Gulshan', name: 'Gulshan', bn: 'গুলশান', districtId: 'Dhaka' },
  { id: 'Hazaribagh', name: 'Hazaribagh', bn: 'হাজারীবাগ', districtId: 'Dhaka' },
  { id: 'Jatrabari', name: 'Jatrabari', bn: 'যাত্রাবাড়ী', districtId: 'Dhaka' },
  { id: 'Kadamtali', name: 'Kadamtali', bn: 'কদমতলী', districtId: 'Dhaka' },
  { id: 'Kafrul', name: 'Kafrul', bn: 'কাফরুল', districtId: 'Dhaka' },
  { id: 'Kalabagan', name: 'Kalabagan', bn: 'কলাবাগান', districtId: 'Dhaka' },
  { id: 'Kamrangirchar', name: 'Kamrangirchar', bn: 'কামরাঙ্গীরচর', districtId: 'Dhaka' },
  { id: 'Keraniganj', name: 'Keraniganj', bn: 'কেরানীগঞ্জ', districtId: 'Dhaka' },
  { id: 'Khilgaon', name: 'Khilgaon', bn: 'খিলগাঁও', districtId: 'Dhaka' },
  { id: 'Khilkhet', name: 'Khilkhet', bn: 'খিলক্ষেত', districtId: 'Dhaka' },
  { id: 'Kotwali', name: 'Kotwali', bn: 'কোতোয়ালি', districtId: 'Dhaka' },
  { id: 'Lalbagh', name: 'Lalbagh', bn: 'লালবাগ', districtId: 'Dhaka' },
  { id: 'Mirpur', name: 'Mirpur', bn: 'মিরপুর', districtId: 'Dhaka' },
  { id: 'Mohammadpur', name: 'Mohammadpur', bn: 'মোহাম্মদপুর', districtId: 'Dhaka' },
  { id: 'Motijheel', name: 'Motijheel', bn: 'মতিঝিল', districtId: 'Dhaka' },
  { id: 'Nawabganj', name: 'Nawabganj', bn: 'নবাবগঞ্জ', districtId: 'Dhaka' },
  { id: 'New Market', name: 'New Market', bn: 'নিউমার্কেট', districtId: 'Dhaka' },
  { id: 'Pallabi', name: 'Pallabi', bn: 'পল্লবী', districtId: 'Dhaka' },
  { id: 'Paltan', name: 'Paltan', bn: 'পল্টন', districtId: 'Dhaka' },
  { id: 'Ramna', name: 'Ramna', bn: 'রমনা', districtId: 'Dhaka' },
  { id: 'Rampura', name: 'Rampura', bn: 'রামপুরা', districtId: 'Dhaka' },
  { id: 'Sabujbagh', name: 'Sabujbagh', bn: 'সবুজবাগ', districtId: 'Dhaka' },
  { id: 'Savar', name: 'Savar', bn: 'সাভার', districtId: 'Dhaka' },
  { id: 'Shah Ali', name: 'Shah Ali', bn: 'শাহ আলী', districtId: 'Dhaka' },
  { id: 'Shahbagh', name: 'Shahbagh', bn: 'শাহবাগ', districtId: 'Dhaka' },
  {
    id: 'Sher-E-Bangla Nagar',
    name: 'Sher-E-Bangla Nagar',
    bn: 'শেরেবাংলা নগর',
    districtId: 'Dhaka',
  },
  { id: 'Shyampur', name: 'Shyampur', bn: 'শ্যামপুর', districtId: 'Dhaka' },
  { id: 'Sutrapur', name: 'Sutrapur', bn: 'সূত্রাপুর', districtId: 'Dhaka' },
  { id: 'Tejgaon', name: 'Tejgaon', bn: 'তেজগাঁও', districtId: 'Dhaka' },
  {
    id: 'Tejgaon Industrial Area',
    name: 'Tejgaon Industrial Area',
    bn: 'তেজগাঁও শিল্প এলাকা',
    districtId: 'Dhaka',
  },

  // Dinajpur District
  { id: 'Biral', name: 'Biral', bn: 'বিরল', districtId: 'Dinajpur' },
  { id: 'Birampur', name: 'Birampur', bn: 'বিরামপুর', districtId: 'Dinajpur' },
  { id: 'Birganj', name: 'Birganj', bn: 'বীরগঞ্জ', districtId: 'Dinajpur' },
  { id: 'Bochaganj', name: 'Bochaganj', bn: 'বোচাগঞ্জ', districtId: 'Dinajpur' },
  { id: 'Chirirbandar', name: 'Chirirbandar', bn: 'চিরিরবন্দর', districtId: 'Dinajpur' },
  { id: 'Dinajpur Sadar', name: 'Dinajpur Sadar', bn: 'দিনাজপুর সদর', districtId: 'Dinajpur' },
  { id: 'Ghoraghat', name: 'Ghoraghat', bn: 'ঘোড়াঘাট', districtId: 'Dinajpur' },
  { id: 'Hakimpur', name: 'Hakimpur', bn: 'হাকিমপুর', districtId: 'Dinajpur' },
  { id: 'Kaharole', name: 'Kaharole', bn: 'কাহারোল', districtId: 'Dinajpur' },
  { id: 'Khansama', name: 'Khansama', bn: 'খানসামা', districtId: 'Dinajpur' },
  { id: 'Nawabganj', name: 'Nawabganj', bn: 'নবাবগঞ্জ', districtId: 'Dinajpur' },
  { id: 'Parbatipur', name: 'Parbatipur', bn: 'পার্বতীপুর', districtId: 'Dinajpur' },
  { id: 'Phulbari', name: 'Phulbari', bn: 'ফুলবাড়ী', districtId: 'Dinajpur' },

  // Faridpur District
  { id: 'Alfadanga', name: 'Alfadanga', bn: 'আলফাডাঙ্গা', districtId: 'Faridpur' },
  { id: 'Bhanga', name: 'Bhanga', bn: 'ভাঙ্গা', districtId: 'Faridpur' },
  { id: 'Boalmari', name: 'Boalmari', bn: 'বোয়ালমারী', districtId: 'Faridpur' },
  { id: 'Charbhadrasan', name: 'Charbhadrasan', bn: 'চরভদ্রাসন', districtId: 'Faridpur' },
  { id: 'Faridpur Sadar', name: 'Faridpur Sadar', bn: 'ফরিদপুর সদর', districtId: 'Faridpur' },
  { id: 'Madhukhali', name: 'Madhukhali', bn: 'মধুখালী', districtId: 'Faridpur' },
  { id: 'Nagarkanda', name: 'Nagarkanda', bn: 'নগরকান্দা', districtId: 'Faridpur' },
  { id: 'Sadarpur', name: 'Sadarpur', bn: 'সদরপুর', districtId: 'Faridpur' },
  { id: 'Saltha', name: 'Saltha', bn: 'সালথা', districtId: 'Faridpur' },

  // Feni District
  { id: 'Chhagalnaiya', name: 'Chhagalnaiya', bn: 'ছাগলনাইয়া', districtId: 'Feni' },
  { id: 'Daganbhuiyan', name: 'Daganbhuiyan', bn: 'দাগনভূঞা', districtId: 'Feni' },
  { id: 'Feni Sadar', name: 'Feni Sadar', bn: 'ফেনী সদর', districtId: 'Feni' },
  { id: 'Fulgazi', name: 'Fulgazi', bn: 'ফুলগাজী', districtId: 'Feni' },
  { id: 'Parshuram', name: 'Parshuram', bn: 'পরশুরাম', districtId: 'Feni' },
  { id: 'Sonagazi', name: 'Sonagazi', bn: 'সোনাগাজী', districtId: 'Feni' },

  // Gaibandha District
  { id: 'Gaibandha Sadar', name: 'Gaibandha Sadar', bn: 'গাইবান্ধা সদর', districtId: 'Gaibandha' },
  { id: 'Gobindaganj', name: 'Gobindaganj', bn: 'গোবিন্দগঞ্জ', districtId: 'Gaibandha' },
  { id: 'Palashbari', name: 'Palashbari', bn: 'পলাশবাড়ী', districtId: 'Gaibandha' },
  { id: 'Phulchhari', name: 'Phulchhari', bn: 'ফুলছড়ি', districtId: 'Gaibandha' },
  { id: 'Sadullapur', name: 'Sadullapur', bn: 'সাদুল্লাপুর', districtId: 'Gaibandha' },
  { id: 'Saghata', name: 'Saghata', bn: 'সাঘাটা', districtId: 'Gaibandha' },
  { id: 'Sundarganj', name: 'Sundarganj', bn: 'সুন্দরগঞ্জ', districtId: 'Gaibandha' },

  // Gazipur District
  { id: 'Gazipur Sadar', name: 'Gazipur Sadar', bn: 'গাজীপুর সদর', districtId: 'Gazipur' },
  { id: 'Kaliakair', name: 'Kaliakair', bn: 'কালিয়াকৈর', districtId: 'Gazipur' },
  { id: 'Kaliganj', name: 'Kaliganj', bn: 'কালীগঞ্জ', districtId: 'Gazipur' },
  { id: 'Kapasia', name: 'Kapasia', bn: 'কাপাসিয়া', districtId: 'Gazipur' },
  { id: 'Sripur', name: 'Sripur', bn: 'শ্রীপুর', districtId: 'Gazipur' },

  // Gopalganj District
  { id: 'Gopalganj Sadar', name: 'Gopalganj Sadar', bn: 'গোপালগঞ্জ সদর', districtId: 'Gopalganj' },
  { id: 'Kashiani', name: 'Kashiani', bn: 'কাশিয়ানী', districtId: 'Gopalganj' },
  { id: 'Kotalipara', name: 'Kotalipara', bn: 'কোটালীপাড়া', districtId: 'Gopalganj' },
  { id: 'Muksudpur', name: 'Muksudpur', bn: 'মুকসুদপুর', districtId: 'Gopalganj' },
  { id: 'Tungipara', name: 'Tungipara', bn: 'টুঙ্গিপাড়া', districtId: 'Gopalganj' },

  // Habiganj District
  { id: 'Ajmiriganj', name: 'Ajmiriganj', bn: 'আজমিরীগঞ্জ', districtId: 'Habiganj' },
  { id: 'Bahubal', name: 'Bahubal', bn: 'বাহুবল', districtId: 'Habiganj' },
  { id: 'Baniachang', name: 'Baniachang', bn: 'বানিয়াচং', districtId: 'Habiganj' },
  { id: 'Chunarughat', name: 'Chunarughat', bn: 'চুনারুঘাট', districtId: 'Habiganj' },
  { id: 'Habiganj Sadar', name: 'Habiganj Sadar', bn: 'হবিগঞ্জ সদর', districtId: 'Habiganj' },
  { id: 'Lakhai', name: 'Lakhai', bn: 'লাখাই', districtId: 'Habiganj' },
  { id: 'Madhabpur', name: 'Madhabpur', bn: 'মাধবপুর', districtId: 'Habiganj' },
  { id: 'Nabiganj', name: 'Nabiganj', bn: 'নবীগঞ্জ', districtId: 'Habiganj' },

  // Joypurhat District
  { id: 'Panchbibi', name: 'Panchbibi', bn: 'পাঁচবিবি', districtId: 'Joypurhat' },
  { id: 'Akkelpur', name: 'Akkelpur', bn: 'আক্কেলপুর', districtId: 'Joypurhat' },
  { id: 'Joypurhat Sadar', name: 'Joypurhat Sadar', bn: 'জয়পুরহাট সদর', districtId: 'Joypurhat' },
  { id: 'Kalai', name: 'Kalai', bn: 'কালাই', districtId: 'Joypurhat' },
  { id: 'Khetlal', name: 'Khetlal', bn: 'ক্ষেতলাল', districtId: 'Joypurhat' },

  // Jamalpur District
  { id: 'Bakshiganj', name: 'Bakshiganj', bn: 'বকশীগঞ্জ', districtId: 'Jamalpur' },
  { id: 'Dewanganj', name: 'Dewanganj', bn: 'দেওয়ানগঞ্জ', districtId: 'Jamalpur' },
  { id: 'Islampur', name: 'Islampur', bn: 'ইসলামপুর', districtId: 'Jamalpur' },
  { id: 'Jamalpur Sadar', name: 'Jamalpur Sadar', bn: 'জামালপুর সদর', districtId: 'Jamalpur' },
  { id: 'Madarganj', name: 'Madarganj', bn: 'মাদারগঞ্জ', districtId: 'Jamalpur' },
  { id: 'Melandaha', name: 'Melandaha', bn: 'মেলান্দহ', districtId: 'Jamalpur' },
  { id: 'Sarishabari', name: 'Sarishabari', bn: 'সরিষাবাড়ী', districtId: 'Jamalpur' },

  // Jashore District
  { id: 'Abhaynagar', name: 'Abhaynagar', bn: 'অভয়নগর', districtId: 'Jashore' },
  { id: 'Bagherpara', name: 'Bagherpara', bn: 'বাঘারপাড়া', districtId: 'Jashore' },
  { id: 'Chaugachha', name: 'Chaugachha', bn: 'চৌগাছা', districtId: 'Jashore' },
  { id: 'Jessore Sadar', name: 'Jessore Sadar', bn: 'যশোর সদর', districtId: 'Jashore' },
  { id: 'Jhikargacha', name: 'Jhikargacha', bn: 'ঝিকরগাছা', districtId: 'Jashore' },
  { id: 'Keshabpur', name: 'Keshabpur', bn: 'কেশবপুর', districtId: 'Jashore' },
  { id: 'Manirampur', name: 'Manirampur', bn: 'মণিরামপুর', districtId: 'Jashore' },
  { id: 'Sharsha', name: 'Sharsha', bn: 'শার্শা', districtId: 'Jashore' },

  // Jhalakati District
  { id: 'Jhalakati Sadar', name: 'Jhalakati Sadar', bn: 'ঝালকাঠি সদর', districtId: 'Jhalakati' },
  { id: 'Kanthalia', name: 'Kanthalia', bn: 'কাঠালিয়া', districtId: 'Jhalakati' },
  { id: 'Nalchiti', name: 'Nalchiti', bn: 'নলছিটি', districtId: 'Jhalakati' },
  { id: 'Rajapur', name: 'Rajapur', bn: 'রাজাপুর', districtId: 'Jhalakati' },

  // Jhenaidah District
  { id: 'Harinakundu', name: 'Harinakundu', bn: 'হরিণাকুন্ডু', districtId: 'Jhenaidah' },
  { id: 'Jhenaidah Sadar', name: 'Jhenaidah Sadar', bn: 'ঝিনাইদহ সদর', districtId: 'Jhenaidah' },
  { id: 'Kaliganj', name: 'Kaliganj', bn: 'কালীগঞ্জ', districtId: 'Jhenaidah' },
  { id: 'Kotchandpur', name: 'Kotchandpur', bn: 'কোটচাঁদপুর', districtId: 'Jhenaidah' },
  { id: 'Maheshpur', name: 'Maheshpur', bn: 'মহেশপুর', districtId: 'Jhenaidah' },
  { id: 'Shailkupa', name: 'Shailkupa', bn: 'শৈলকুপা', districtId: 'Jhenaidah' },

  // Khagrachhari District
  { id: 'Dighinala', name: 'Dighinala', bn: 'দীঘিনালা', districtId: 'Khagrachhari' },
  {
    id: 'Khagrachhari Sadar',
    name: 'Khagrachhari Sadar',
    bn: 'খাগড়াছড়ি সদর',
    districtId: 'Khagrachhari',
  },
  { id: 'Lakshmichhari', name: 'Lakshmichhari', bn: 'লক্ষ্মীছড়ি', districtId: 'Khagrachhari' },
  { id: 'Mahalchhari', name: 'Mahalchhari', bn: 'মহালছড়ি', districtId: 'Khagrachhari' },
  { id: 'Manikchhari', name: 'Manikchhari', bn: 'মানিকছড়ি', districtId: 'Khagrachhari' },
  { id: 'Matiranga', name: 'Matiranga', bn: 'মাটিরাঙ্গা', districtId: 'Khagrachhari' },
  { id: 'Panchhari', name: 'Panchhari', bn: 'পানছড়ি', districtId: 'Khagrachhari' },
  { id: 'Ramgarh', name: 'Ramgarh', bn: 'রামগড়', districtId: 'Khagrachhari' },

  // Khulna District
  { id: 'Batiaghata', name: 'Batiaghata', bn: 'বটিয়াঘাটা', districtId: 'Khulna' },
  { id: 'Dacope', name: 'Dacope', bn: 'দাকোপ', districtId: 'Khulna' },
  { id: 'Daulatpur', name: 'Daulatpur', bn: 'দৌলতপুর', districtId: 'Khulna' },
  { id: 'Dighalia', name: 'Dighalia', bn: 'দিঘলিয়া', districtId: 'Khulna' },
  { id: 'Dumuria', name: 'Dumuria', bn: 'ডুমুরিয়া', districtId: 'Khulna' },
  { id: 'Khalishpur', name: 'Khalishpur', bn: 'খালিশপুর', districtId: 'Khulna' },
  { id: 'Khan Jahan Ali', name: 'Khan Jahan Ali', bn: 'খানজাহান আলী', districtId: 'Khulna' },
  { id: 'Khulna Sadar', name: 'Khulna Sadar', bn: 'খুলনা সদর', districtId: 'Khulna' },
  { id: 'Koyra', name: 'Koyra', bn: 'কয়রা', districtId: 'Khulna' },
  { id: 'Paikgachha', name: 'Paikgachha', bn: 'পাইকগাছা', districtId: 'Khulna' },
  { id: 'Phultala', name: 'Phultala', bn: 'ফুলতলা', districtId: 'Khulna' },
  { id: 'Rupsa', name: 'Rupsa', bn: 'রূপসা', districtId: 'Khulna' },
  { id: 'Sonadanga', name: 'Sonadanga', bn: 'সোনাডাঙ্গা', districtId: 'Khulna' },
  { id: 'Terokhada', name: 'Terokhada', bn: 'তেরখাদা', districtId: 'Khulna' },

  // Kishoreganj District
  { id: 'Austagram', name: 'Austagram', bn: 'অষ্টগ্রাম', districtId: 'Kishoreganj' },
  { id: 'Bajitpur', name: 'Bajitpur', bn: 'বাজিতপুর', districtId: 'Kishoreganj' },
  { id: 'Bhairab', name: 'Bhairab', bn: 'ভৈরব', districtId: 'Kishoreganj' },
  { id: 'Hossainpur', name: 'Hossainpur', bn: 'হোসেনপুর', districtId: 'Kishoreganj' },
  { id: 'Itna', name: 'Itna', bn: 'ইটনা', districtId: 'Kishoreganj' },
  { id: 'Karimganj', name: 'Karimganj', bn: 'করিমগঞ্জ', districtId: 'Kishoreganj' },
  { id: 'Katiadi', name: 'Katiadi', bn: 'কটিয়াদী', districtId: 'Kishoreganj' },
  {
    id: 'Kishoreganj Sadar',
    name: 'Kishoreganj Sadar',
    bn: 'কিশোরগঞ্জ সদর',
    districtId: 'Kishoreganj',
  },
  { id: 'Kuliarchar', name: 'Kuliarchar', bn: 'কুলিয়ারচর', districtId: 'Kishoreganj' },
  { id: 'Mithamain', name: 'Mithamain', bn: 'মিঠামইন', districtId: 'Kishoreganj' },
  { id: 'Nikli', name: 'Nikli', bn: 'নিকলী', districtId: 'Kishoreganj' },
  { id: 'Pakundia', name: 'Pakundia', bn: 'পাকুন্দিয়া', districtId: 'Kishoreganj' },
  { id: 'Tarail', name: 'Tarail', bn: 'তাড়াইল', districtId: 'Kishoreganj' },

  // Kurigram District
  { id: 'Bhurungamari', name: 'Bhurungamari', bn: 'ভূরুঙ্গামারী', districtId: 'Kurigram' },
  { id: 'Char Rajibpur', name: 'Char Rajibpur', bn: 'চর রাজিবপুর', districtId: 'Kurigram' },
  { id: 'Chilmari', name: 'Chilmari', bn: 'চিলমারী', districtId: 'Kurigram' },
  { id: 'Kurigram Sadar', name: 'Kurigram Sadar', bn: 'কুড়িগ্রাম সদর', districtId: 'Kurigram' },
  { id: 'Nageshwari', name: 'Nageshwari', bn: 'নাগেশ্বরী', districtId: 'Kurigram' },
  { id: 'Phulbari', name: 'Phulbari', bn: 'ফুলবাড়ী', districtId: 'Kurigram' },
  { id: 'Rajarhat', name: 'Rajarhat', bn: 'রাজারহাট', districtId: 'Kurigram' },
  { id: 'Raumari', name: 'Raumari', bn: 'রৌমারী', districtId: 'Kurigram' },
  { id: 'Ulipur', name: 'Ulipur', bn: 'উলিপুর', districtId: 'Kurigram' },

  // Kushtia District
  { id: 'Bheramara', name: 'Bheramara', bn: 'ভেড়ামারা', districtId: 'Kushtia' },
  { id: 'Daulatpur', name: 'Daulatpur', bn: 'দৌলতপুর', districtId: 'Kushtia' },
  { id: 'Khoksa', name: 'Khoksa', bn: 'খোকসা', districtId: 'Kushtia' },
  { id: 'Kumarkhali', name: 'Kumarkhali', bn: 'কুমারখালী', districtId: 'Kushtia' },
  { id: 'Kushtia Sadar', name: 'Kushtia Sadar', bn: 'কুষ্টিয়া সদর', districtId: 'Kushtia' },
  { id: 'Mirpur', name: 'Mirpur', bn: 'মিরপুর', districtId: 'Kushtia' },

  // Lakshmipur District
  { id: 'Chandraganj', name: 'Chandraganj', bn: 'চন্দ্রগঞ্জ', districtId: 'Lakshmipur' },
  { id: 'Kamalnagar', name: 'Kamalnagar', bn: 'কমলনগর', districtId: 'Lakshmipur' },
  {
    id: 'Lakshmipur Sadar',
    name: 'Lakshmipur Sadar',
    bn: 'লক্ষ্মীপুর সদর',
    districtId: 'Lakshmipur',
  },
  { id: 'Raipur', name: 'Raipur', bn: 'রায়পুর', districtId: 'Lakshmipur' },
  { id: 'Ramganj', name: 'Ramganj', bn: 'রামগঞ্জ', districtId: 'Lakshmipur' },
  { id: 'Ramgati', name: 'Ramgati', bn: 'রামগতি', districtId: 'Lakshmipur' },

  // Lalmonirhat District
  { id: 'Aditmari', name: 'Aditmari', bn: 'আদিতমারী', districtId: 'Lalmonirhat' },
  { id: 'Hatibandha', name: 'Hatibandha', bn: 'হাতীবান্ধা', districtId: 'Lalmonirhat' },
  { id: 'Kaliganj', name: 'Kaliganj', bn: 'কালীগঞ্জ', districtId: 'Lalmonirhat' },
  {
    id: 'Lalmonirhat Sadar',
    name: 'Lalmonirhat Sadar',
    bn: 'লালমনিরহাট সদর',
    districtId: 'Lalmonirhat',
  },
  { id: 'Patgram', name: 'Patgram', bn: 'পাটগ্রাম', districtId: 'Lalmonirhat' },

  // Madaripur District
  { id: 'Dasa', name: 'Dasa', bn: 'ডাসার', districtId: 'Madaripur' },
  { id: 'Kalkini', name: 'Kalkini', bn: 'কালকিনি', districtId: 'Madaripur' },
  { id: 'Madaripur Sadar', name: 'Madaripur Sadar', bn: 'মাদারীপুর সদর', districtId: 'Madaripur' },
  { id: 'Rajoir', name: 'Rajoir', bn: 'রাজৈর', districtId: 'Madaripur' },
  { id: 'Shibchar', name: 'Shibchar', bn: 'শিবচর', districtId: 'Madaripur' },

  // Magura District
  { id: 'Magura Sadar', name: 'Magura Sadar', bn: 'মাগুরা সদর', districtId: 'Magura' },
  { id: 'Mohammadpur', name: 'Mohammadpur', bn: 'মহম্মদপুর', districtId: 'Magura' },
  { id: 'Shalikha', name: 'Shalikha', bn: 'শালিখা', districtId: 'Magura' },
  { id: 'Sreepur', name: 'Sreepur', bn: 'শ্রীপুর', districtId: 'Magura' },

  // Manikganj District
  { id: 'Daulatpur', name: 'Daulatpur', bn: 'দৌলতপুর', districtId: 'Manikganj' },
  { id: 'Ghior', name: 'Ghior', bn: 'ঘিওর', districtId: 'Manikganj' },
  { id: 'Harirampur', name: 'Harirampur', bn: 'হরিরামপুর', districtId: 'Manikganj' },
  { id: 'Manikganj Sadar', name: 'Manikganj Sadar', bn: 'মানিকগঞ্জ সদর', districtId: 'Manikganj' },
  { id: 'Saturia', name: 'Saturia', bn: 'সাটুরিয়া', districtId: 'Manikganj' },
  { id: 'Shibalaya', name: 'Shibalaya', bn: 'শিবালয়', districtId: 'Manikganj' },
  { id: 'Singair', name: 'Singair', bn: 'সিঙ্গাইর', districtId: 'Manikganj' },

  // Maulavibazar District
  { id: 'Barlekha', name: 'Barlekha', bn: 'বড়লেখা', districtId: 'Maulavibazar' },
  { id: 'Juri', name: 'Juri', bn: 'জুড়ী', districtId: 'Maulavibazar' },
  { id: 'Kamalganj', name: 'Kamalganj', bn: 'কমলগঞ্জ', districtId: 'Maulavibazar' },
  { id: 'Kulaura', name: 'Kulaura', bn: 'কুলাউড়া', districtId: 'Maulavibazar' },
  {
    id: 'Maulvi Bazar Sadar',
    name: 'Maulvi Bazar Sadar',
    bn: 'মৌলভীবাজার সদর',
    districtId: 'Maulavibazar',
  },
  { id: 'Rajnagar', name: 'Rajnagar', bn: 'রাজনগর', districtId: 'Maulavibazar' },
  { id: 'Sreemangal', name: 'Sreemangal', bn: 'শ্রীমঙ্গল', districtId: 'Maulavibazar' },

  // Meherpur District
  { id: 'Gangni', name: 'Gangni', bn: 'গাংনী', districtId: 'Meherpur' },
  { id: 'Meherpur Sadar', name: 'Meherpur Sadar', bn: 'মেহেরপুর সদর', districtId: 'Meherpur' },
  { id: 'Mujibnagar', name: 'Mujibnagar', bn: 'মুজিবনগর', districtId: 'Meherpur' },

  // Munshiganj District
  { id: 'Gazaria', name: 'Gazaria', bn: 'গজারিয়া', districtId: 'Munshiganj' },
  { id: 'Lohajang', name: 'Lohajang', bn: 'লৌহজং', districtId: 'Munshiganj' },
  {
    id: 'Munshiganj Sadar',
    name: 'Munshiganj Sadar',
    bn: 'মুন্সীগঞ্জ সদর',
    districtId: 'Munshiganj',
  },
  { id: 'Sirajdikhan', name: 'Sirajdikhan', bn: 'সিরাজদিখান', districtId: 'Munshiganj' },
  { id: 'Sreenagar', name: 'Sreenagar', bn: 'শ্রীনগর', districtId: 'Munshiganj' },
  { id: 'Tongibari', name: 'Tongibari', bn: 'টংগিবাড়ী', districtId: 'Munshiganj' },

  // Mymensingh District
  { id: 'Bhaluka', name: 'Bhaluka', bn: 'ভালুকা', districtId: 'Mymensingh' },
  { id: 'Dhobaura', name: 'Dhobaura', bn: 'ধোবাউড়া', districtId: 'Mymensingh' },
  { id: 'Fulbaria', name: 'Fulbaria', bn: 'ফুলবাড়ীয়া', districtId: 'Mymensingh' },
  { id: 'Gaffargaon', name: 'Gaffargaon', bn: 'গফরগাঁও', districtId: 'Mymensingh' },
  { id: 'Gouripur', name: 'Gouripur', bn: 'গৌরীপুর', districtId: 'Mymensingh' },
  { id: 'Haluaghat', name: 'Haluaghat', bn: 'হালুয়াঘাট', districtId: 'Mymensingh' },
  { id: 'Ishwarganj', name: 'Ishwarganj', bn: 'ঈশ্বরগঞ্জ', districtId: 'Mymensingh' },
  { id: 'Muktagachha', name: 'Muktagachha', bn: 'মুক্তাগাছা', districtId: 'Mymensingh' },
  {
    id: 'Mymensingh Sadar',
    name: 'Mymensingh Sadar',
    bn: 'ময়মনসিংহ সদর',
    districtId: 'Mymensingh',
  },
  { id: 'Nandail', name: 'Nandail', bn: 'নান্দাইল', districtId: 'Mymensingh' },
  { id: 'Phulpur', name: 'Phulpur', bn: 'ফুলপুর', districtId: 'Mymensingh' },
  { id: 'Sapahar', name: 'Sapahar', bn: 'সাপাহার', districtId: 'Mymensingh' },
  { id: 'Trishal', name: 'Trishal', bn: 'ত্রিশাল', districtId: 'Mymensingh' },

  // Naogaon District
  { id: 'Atrai', name: 'Atrai', bn: 'আত্রাই', districtId: 'Naogaon' },
  { id: 'Badalgachhi', name: 'Badalgachhi', bn: 'বদলগাছী', districtId: 'Naogaon' },
  { id: 'Dhamoirhat', name: 'Dhamoirhat', bn: 'ধামুরহাট', districtId: 'Naogaon' },
  { id: 'Mahadebpur', name: 'Mahadebpur', bn: 'মহাদেবপুর', districtId: 'Naogaon' },
  { id: 'Manda', name: 'Manda', bn: 'মান্দা', districtId: 'Naogaon' },
  { id: 'Naogaon Sadar', name: 'Naogaon Sadar', bn: 'নওগাঁ সদর', districtId: 'Naogaon' },
  { id: 'Niamatpur', name: 'Niamatpur', bn: 'নিয়ামতপুর', districtId: 'Naogaon' },
  { id: 'Patnitala', name: 'Patnitala', bn: 'পত্নীতলা', districtId: 'Naogaon' },
  { id: 'Porsha', name: 'Porsha', bn: 'পোরশা', districtId: 'Naogaon' },
  { id: 'Raninagar', name: 'Raninagar', bn: 'রাণীনগর', districtId: 'Naogaon' },

  // Narail District
  { id: 'Kalia', name: 'Kalia', bn: 'কালিয়া', districtId: 'Narail' },
  { id: 'Lohagara', name: 'Lohagara', bn: 'লোহাগড়া', districtId: 'Narail' },
  { id: 'Narail Sadar', name: 'Narail Sadar', bn: 'নড়াইল সদর', districtId: 'Narail' },

  // Narayanganj District
  { id: 'Araihazar', name: 'Araihazar', bn: 'আড়াইহাজার', districtId: 'Narayanganj' },
  { id: 'Bandar', name: 'Bandar', bn: 'বন্দর', districtId: 'Narayanganj' },
  {
    id: 'Narayanganj Sadar',
    name: 'Narayanganj Sadar',
    bn: 'নারায়ণগঞ্জ সদর',
    districtId: 'Narayanganj',
  },
  { id: 'Rupganj', name: 'Rupganj', bn: 'রূপগঞ্জ', districtId: 'Narayanganj' },
  { id: 'Sonargaon', name: 'Sonargaon', bn: 'সোনারগাঁও', districtId: 'Narayanganj' },

  // Narsingdi District
  { id: 'Belabo', name: 'Belabo', bn: 'বেলাবো', districtId: 'Narsingdi' },
  { id: 'Manohardi', name: 'Manohardi', bn: 'মনোহরদী', districtId: 'Narsingdi' },
  { id: 'Narsingdi Sadar', name: 'Narsingdi Sadar', bn: 'নরসিংদী সদর', districtId: 'Narsingdi' },
  { id: 'Palash', name: 'Palash', bn: 'পলাশ', districtId: 'Narsingdi' },
  { id: 'Raipura', name: 'Raipura', bn: 'রায়পুরা', districtId: 'Narsingdi' },
  { id: 'Shibpur', name: 'Shibpur', bn: 'শিবপুর', districtId: 'Narsingdi' },

  // Natore District
  { id: 'Bagatipara', name: 'Bagatipara', bn: 'বাগাতিপাড়া', districtId: 'Natore' },
  { id: 'Baraigram', name: 'Baraigram', bn: 'বড়াইগ্রাম', districtId: 'Natore' },
  { id: 'Gurudaspur', name: 'Gurudaspur', bn: 'গুরুদাসপুর', districtId: 'Natore' },
  { id: 'Lalpur', name: 'Lalpur', bn: 'লালপুর', districtId: 'Natore' },
  { id: 'Naldanga', name: 'Naldanga', bn: 'নলডাঙ্গা', districtId: 'Natore' },
  { id: 'Natore Sadar', name: 'Natore Sadar', bn: 'নাটোর সদর', districtId: 'Natore' },
  { id: 'Singra', name: 'Singra', bn: 'সিংড়া', districtId: 'Natore' },

  // Netrakona District
  { id: 'Atpara', name: 'Atpara', bn: 'আটপাড়া', districtId: 'Netrakona' },
  { id: 'Barhatta', name: 'Barhatta', bn: 'বারহাট্টা', districtId: 'Netrakona' },
  { id: 'Durgapur', name: 'Durgapur', bn: 'দুর্গাপুর', districtId: 'Netrakona' },
  { id: 'Kalmakanda', name: 'Kalmakanda', bn: 'কলমাকান্দা', districtId: 'Netrakona' },
  { id: 'Kendua', name: 'Kendua', bn: 'কেন্দুয়া', districtId: 'Netrakona' },
  { id: 'Khaliajuri', name: 'Khaliajuri', bn: 'খালিয়াজুড়ি', districtId: 'Netrakona' },
  { id: 'Madan', name: 'Madan', bn: 'মদন', districtId: 'Netrakona' },
  { id: 'Mohanganj', name: 'Mohanganj', bn: 'মোহনগঞ্জ', districtId: 'Netrakona' },
  { id: 'Netrakona Sadar', name: 'Netrakona Sadar', bn: 'নেত্রকোণা সদর', districtId: 'Netrakona' },
  { id: 'Purbadhala', name: 'Purbadhala', bn: 'পূর্বধলা', districtId: 'Netrakona' },

  // Nilphamari District
  { id: 'Dimla', name: 'Dimla', bn: 'ডিমলা', districtId: 'Nilphamari' },
  { id: 'Domar', name: 'Domar', bn: 'ডোমার', districtId: 'Nilphamari' },
  { id: 'Jaldhaka', name: 'Jaldhaka', bn: 'জলঢাকা', districtId: 'Nilphamari' },
  { id: 'Kishoreganj', name: 'Kishoreganj', bn: 'কিশোরগঞ্জ', districtId: 'Nilphamari' },
  {
    id: 'Nilphamari Sadar',
    name: 'Nilphamari Sadar',
    bn: 'নীলফামারী সদর',
    districtId: 'Nilphamari',
  },
  { id: 'Saidpur', name: 'Saidpur', bn: 'সৈয়দপুর', districtId: 'Nilphamari' },

  // Noakhali District
  { id: 'Begumganj', name: 'Begumganj', bn: 'বেগমগঞ্জ', districtId: 'Noakhali' },
  { id: 'Chatkhil', name: 'Chatkhil', bn: 'চাটখিল', districtId: 'Noakhali' },
  { id: 'Companiganj', name: 'Companiganj', bn: 'কোম্পানীগঞ্জ', districtId: 'Noakhali' },
  { id: 'Hatiya', name: 'Hatiya', bn: 'হাতিয়া', districtId: 'Noakhali' },
  { id: 'Kabirhat', name: 'Kabirhat', bn: 'কবিরহাট', districtId: 'Noakhali' },
  { id: 'Noakhali Sadar', name: 'Noakhali Sadar', bn: 'নোয়াখালী সদর', districtId: 'Noakhali' },
  { id: 'Senbagh', name: 'Senbagh', bn: 'সেনবাগ', districtId: 'Noakhali' },
  { id: 'Sonaimuri', name: 'Sonaimuri', bn: 'সোনাইমুড়ি', districtId: 'Noakhali' },
  { id: 'Subarnachar', name: 'Subarnachar', bn: 'সুবর্ণচর', districtId: 'Noakhali' },

  // Pabna District
  { id: 'Atgharia', name: 'Atgharia', bn: 'আটঘরিয়া', districtId: 'Pabna' },
  { id: 'Bera', name: 'Bera', bn: 'বেড়া', districtId: 'Pabna' },
  { id: 'Bhangura', name: 'Bhangura', bn: 'ভাঙ্গুড়া', districtId: 'Pabna' },
  { id: 'Chatmohar', name: 'Chatmohar', bn: 'চাটমোহর', districtId: 'Pabna' },
  { id: 'Faridpur', name: 'Faridpur', bn: 'ফরিদপুর', districtId: 'Pabna' },
  { id: 'Ishwardi', name: 'Ishwardi', bn: 'ঈশ্বরদী', districtId: 'Pabna' },
  { id: 'Pabna Sadar', name: 'Pabna Sadar', bn: 'পাবনা সদর', districtId: 'Pabna' },
  { id: 'Santhia', name: 'Santhia', bn: 'সাঁথিয়া', districtId: 'Pabna' },
  { id: 'Sujanagar', name: 'Sujanagar', bn: 'সুজানগর', districtId: 'Pabna' },

  // Panchagarh District
  { id: 'Atwari', name: 'Atwari', bn: 'আটোয়ারী', districtId: 'Panchagarh' },
  { id: 'Boda', name: 'Boda', bn: 'বোদা', districtId: 'Panchagarh' },
  { id: 'Debiganj', name: 'Debiganj', bn: 'দেবীগঞ্জ', districtId: 'Panchagarh' },
  {
    id: 'Panchagarh Sadar',
    name: 'Panchagarh Sadar',
    bn: 'পঞ্চগড় সদর',
    districtId: 'Panchagarh',
  },
  { id: 'Tetulia', name: 'Tetulia', bn: 'তেঁতুলিয়া', districtId: 'Panchagarh' },

  // Patuakhali District
  { id: 'Bauphal', name: 'Bauphal', bn: 'বাউফল', districtId: 'Patuakhali' },
  { id: 'Dashmina', name: 'Dashmina', bn: 'দশমিনা', districtId: 'Patuakhali' },
  { id: 'Dumki', name: 'Dumki', bn: 'দুমকি', districtId: 'Patuakhali' },
  { id: 'Galachipa', name: 'Galachipa', bn: 'গলাচিপা', districtId: 'Patuakhali' },
  { id: 'Kalapara', name: 'Kalapara', bn: 'কলাপাড়া', districtId: 'Patuakhali' },
  { id: 'Mirzaganj', name: 'Mirzaganj', bn: 'মির্জাগঞ্জ', districtId: 'Patuakhali' },
  {
    id: 'Patuakhali Sadar',
    name: 'Patuakhali Sadar',
    bn: 'পটুয়াখালী সদর',
    districtId: 'Patuakhali',
  },

  // Pirojpur District
  { id: 'Bhandaria', name: 'Bhandaria', bn: 'ভান্ডারিয়া', districtId: 'Pirojpur' },
  { id: 'Kawkhali', name: 'Kawkhali', bn: 'কাউখালী', districtId: 'Pirojpur' },
  { id: 'Mathbaria', name: 'Mathbaria', bn: 'মঠবাড়িয়া', districtId: 'Pirojpur' },
  { id: 'Nazirpur', name: 'Nazirpur', bn: 'নাজিরপুর', districtId: 'Pirojpur' },
  { id: 'Nesarabad', name: 'Nesarabad', bn: 'নেছারাবাদ', districtId: 'Pirojpur' },
  { id: 'Pirojpur Sadar', name: 'Pirojpur Sadar', bn: 'পিরোজপুর সদর', districtId: 'Pirojpur' },
  { id: 'Zianagar', name: 'Zianagar', bn: 'ইন্দুরকানী', districtId: 'Pirojpur' },

  // Rajbari District
  { id: 'Baliakandi', name: 'Baliakandi', bn: 'বালিয়াকান্দি', districtId: 'Rajbari' },
  { id: 'Goalanda', name: 'Goalanda', bn: 'গোয়ালন্দ', districtId: 'Rajbari' },
  { id: 'Kalukhali', name: 'Kalukhali', bn: 'কালুখালী', districtId: 'Rajbari' },
  { id: 'Pangsha', name: 'Pangsha', bn: 'পাংশা', districtId: 'Rajbari' },
  { id: 'Rajbari Sadar', name: 'Rajbari Sadar', bn: 'রাজবাড়ী সদর', districtId: 'Rajbari' },

  // Rajshahi District
  { id: 'Bagha', name: 'Bagha', bn: 'বাঘা', districtId: 'Rajshahi' },
  { id: 'Baghmara', name: 'Baghmara', bn: 'বাগমারা', districtId: 'Rajshahi' },
  { id: 'Boalia', name: 'Boalia', bn: 'বোয়ালিয়া', districtId: 'Rajshahi' },
  { id: 'Charghat', name: 'Charghat', bn: 'চারঘাট', districtId: 'Rajshahi' },
  { id: 'Durgapur', name: 'Durgapur', bn: 'দুর্গাপুর', districtId: 'Rajshahi' },
  { id: 'Godagari', name: 'Godagari', bn: 'গোদাগাড়ী', districtId: 'Rajshahi' },
  { id: 'Matihar', name: 'Matihar', bn: 'মতিহার', districtId: 'Rajshahi' },
  { id: 'Mohanpur', name: 'Mohanpur', bn: 'মোহনপুর', districtId: 'Rajshahi' },
  { id: 'Paba', name: 'Paba', bn: 'পবা', districtId: 'Rajshahi' },
  { id: 'Puthia', name: 'Puthia', bn: 'পুঠিয়া', districtId: 'Rajshahi' },
  { id: 'Rajpara', name: 'Rajpara', bn: 'রাজপাড়া', districtId: 'Rajshahi' },
  { id: 'Shah Makhdam', name: 'Shah Makhdam', bn: 'শাহ মখদুম', districtId: 'Rajshahi' },
  { id: 'Tanore', name: 'Tanore', bn: 'তানোর', districtId: 'Rajshahi' },

  // Rangamati District
  { id: 'Baghaichhari', name: 'Baghaichhari', bn: 'বাঘাইছড়ি', districtId: 'Rangamati' },
  { id: 'Barkal', name: 'Barkal', bn: 'বরকল', districtId: 'Rangamati' },
  { id: 'Belaichhari', name: 'Belaichhari', bn: 'বিলাইছড়ি', districtId: 'Rangamati' },
  { id: 'Juraichhari', name: 'Juraichhari', bn: 'জুরাছড়ি', districtId: 'Rangamati' },
  { id: 'Kaptai', name: 'Kaptai', bn: 'কাপ্তাই', districtId: 'Rangamati' },
  { id: 'Kawkhali', name: 'Kawkhali', bn: 'কাউখালী', districtId: 'Rangamati' },
  { id: 'Langadu', name: 'Langadu', bn: 'লংগদু', districtId: 'Rangamati' },
  { id: 'Naniarchar', name: 'Naniarchar', bn: 'নানিয়ারচর', districtId: 'Rangamati' },
  { id: 'Rajasthali', name: 'Rajasthali', bn: 'রাজস্থলী', districtId: 'Rangamati' },
  { id: 'Rangamati Sadar', name: 'Rangamati Sadar', bn: 'রাঙ্গামাটি সদর', districtId: 'Rangamati' },

  // Rangpur District
  { id: 'Badarganj', name: 'Badarganj', bn: 'বদরগঞ্জ', districtId: 'Rangpur' },
  { id: 'Gangachara', name: 'Gangachara', bn: 'গংগাচড়া', districtId: 'Rangpur' },
  { id: 'Kaunia', name: 'Kaunia', bn: 'কাউনিয়া', districtId: 'Rangpur' },
  { id: 'Mithapukur', name: 'Mithapukur', bn: 'মিঠাপুকুর', districtId: 'Rangpur' },
  { id: 'Pirgachha', name: 'Pirgachha', bn: 'পীরগাছা', districtId: 'Rangpur' },
  { id: 'Pirganj', name: 'Pirganj', bn: 'পীরগঞ্জ', districtId: 'Rangpur' },
  { id: 'Rangpur Sadar', name: 'Rangpur Sadar', bn: 'রংপুর সদর', districtId: 'Rangpur' },
  { id: 'Taraganj', name: 'Taraganj', bn: 'তারাগঞ্জ', districtId: 'Rangpur' },

  // Satkhira District
  { id: 'Assasuni', name: 'Assasuni', bn: 'আশাশুনি', districtId: 'Satkhira' },
  { id: 'Debhata', name: 'Debhata', bn: 'দেবহাটা', districtId: 'Satkhira' },
  { id: 'Kalaroa', name: 'Kalaroa', bn: 'কলারোয়া', districtId: 'Satkhira' },
  { id: 'Kaliganj', name: 'Kaliganj', bn: 'কালীগঞ্জ', districtId: 'Satkhira' },
  { id: 'Satkhira Sadar', name: 'Satkhira Sadar', bn: 'সাতক্ষীরা সদর', districtId: 'Satkhira' },
  { id: 'Shyamnagar', name: 'Shyamnagar', bn: 'শ্যামনগর', districtId: 'Satkhira' },
  { id: 'Tala', name: 'Tala', bn: 'তালা', districtId: 'Satkhira' },

  // Shariatpur District
  { id: 'Bhedarganj', name: 'Bhedarganj', bn: 'ভেদরগঞ্জ', districtId: 'Shariatpur' },
  { id: 'Damudya', name: 'Damudya', bn: 'ডামুড্যা', districtId: 'Shariatpur' },
  { id: 'Gosairhat', name: 'Gosairhat', bn: 'গোসাইরহাট', districtId: 'Shariatpur' },
  { id: 'Naria', name: 'Naria', bn: 'নড়িয়া', districtId: 'Shariatpur' },
  {
    id: 'Shariatpur Sadar',
    name: 'Shariatpur Sadar',
    bn: 'শরীয়তপুর সদর',
    districtId: 'Shariatpur',
  },
  { id: 'Zajira', name: 'Zajira', bn: 'জাজিরা', districtId: 'Shariatpur' },

  // Sherpur District
  { id: 'Jhenaigati', name: 'Jhenaigati', bn: 'ঝিনাইগাতী', districtId: 'Sherpur' },
  { id: 'Nakla', name: 'Nakla', bn: 'নকলা', districtId: 'Sherpur' },
  { id: 'Nalitabari', name: 'Nalitabari', bn: 'নালিতাবাড়ী', districtId: 'Sherpur' },
  { id: 'Sherpur Sadar', name: 'Sherpur Sadar', bn: 'শেরপুর সদর', districtId: 'Sherpur' },
  { id: 'Sreebardi', name: 'Sreebardi', bn: 'শ্রীবরদী', districtId: 'Sherpur' },

  // Sirajganj District
  { id: 'Belkuchi', name: 'Belkuchi', bn: 'বেলকুচি', districtId: 'Sirajganj' },
  { id: 'Chauhali', name: 'Chauhali', bn: 'চৌহালী', districtId: 'Sirajganj' },
  { id: 'Kamarkhanda', name: 'Kamarkhanda', bn: 'কামারখন্দ', districtId: 'Sirajganj' },
  { id: 'Kazipur', name: 'Kazipur', bn: 'কাজিপুর', districtId: 'Sirajganj' },
  { id: 'Raiganj', name: 'Raiganj', bn: 'রায়গঞ্জ', districtId: 'Sirajganj' },
  { id: 'Shahjadpur', name: 'Shahjadpur', bn: 'শাহজাদপুর', districtId: 'Sirajganj' },
  { id: 'Sirajganj Sadar', name: 'Sirajganj Sadar', bn: 'সিরাজগঞ্জ সদর', districtId: 'Sirajganj' },
  { id: 'Tarash', name: 'Tarash', bn: 'তাড়াশ', districtId: 'Sirajganj' },
  { id: 'Ullahpara', name: 'Ullahpara', bn: 'উল্লাপাড়া', districtId: 'Sirajganj' },

  // Sunamganj District
  { id: 'Bishwambarpur', name: 'Bishwambarpur', bn: 'বিশ্বম্ভরপুর', districtId: 'Sunamganj' },
  { id: 'Chhatak', name: 'Chhatak', bn: 'ছাতক', districtId: 'Sunamganj' },
  { id: 'Derai', name: 'Derai', bn: 'দিরাই', districtId: 'Sunamganj' },
  { id: 'Dowarabazar', name: 'Dowarabazar', bn: 'দোয়ারাবাজার', districtId: 'Sunamganj' },
  { id: 'Jagannathpur', name: 'Jagannathpur', bn: 'জগন্নাথপুর', districtId: 'Sunamganj' },
  { id: 'Jamalganj', name: 'Jamalganj', bn: 'জামালগঞ্জ', districtId: 'Sunamganj' },
  { id: 'Madhyanagar', name: 'Madhyanagar', bn: 'মধ্যনগর', districtId: 'Sunamganj' },
  { id: 'Shantiganj', name: 'Shantiganj', bn: 'শান্তিগঞ্জ', districtId: 'Sunamganj' },
  { id: 'Shalla', name: 'Shalla', bn: 'শাল্লা', districtId: 'Sunamganj' },
  { id: 'Sunamganj Sadar', name: 'Sunamganj Sadar', bn: 'সুনামগঞ্জ সদর', districtId: 'Sunamganj' },
  { id: 'Tahirpur', name: 'Tahirpur', bn: 'তাহিরপুর', districtId: 'Sunamganj' },

  // Sylhet District - Updated with complete list
  { id: 'Balaganj', name: 'Balaganj', bn: 'বালাগঞ্জ', districtId: 'Sylhet' },
  { id: 'Beani Bazar', name: 'Beani Bazar', bn: 'বিয়ানীবাজার', districtId: 'Sylhet' },
  { id: 'Bishwanath', name: 'Bishwanath', bn: 'বিশ্বনাথ', districtId: 'Sylhet' },
  { id: 'Companiganj', name: 'Companiganj', bn: 'কোম্পানীগঞ্জ', districtId: 'Sylhet' },
  { id: 'Dakshin Surma', name: 'Dakshin Surma', bn: 'দক্ষিণ সুরমা', districtId: 'Sylhet' },
  { id: 'Fenchuganj', name: 'Fenchuganj', bn: 'ফেঞ্চুগঞ্জ', districtId: 'Sylhet' },
  { id: 'Golapganj', name: 'Golapganj', bn: 'গোলাপগঞ্জ', districtId: 'Sylhet' },
  { id: 'Gowainghat', name: 'Gowainghat', bn: 'গোয়াইনঘাট', districtId: 'Sylhet' },
  { id: 'Jaintiapur', name: 'Jaintiapur', bn: 'জৈন্তাপুর', districtId: 'Sylhet' },
  { id: 'Kanaighat', name: 'Kanaighat', bn: 'কানাইঘাট', districtId: 'Sylhet' },
  { id: 'Sylhet Sadar', name: 'Sylhet Sadar', bn: 'সিলেট সদর', districtId: 'Sylhet' },
  { id: 'Zakiganj', name: 'Zakiganj', bn: 'জকিগঞ্জ', districtId: 'Sylhet' },

  // Tangail District
  { id: 'Basail', name: 'Basail', bn: 'বাসাইল', districtId: 'Tangail' },
  { id: 'Bhuapur', name: 'Bhuapur', bn: 'ভূঞাপুর', districtId: 'Tangail' },
  { id: 'Delduar', name: 'Delduar', bn: 'দেলদুয়ার', districtId: 'Tangail' },
  { id: 'Dhanbari', name: 'Dhanbari', bn: 'ধনবাড়ী', districtId: 'Tangail' },
  { id: 'Ghatail', name: 'Ghatail', bn: 'ঘাটাইল', districtId: 'Tangail' },
  { id: 'Gopalpur', name: 'Gopalpur', bn: 'গোপালপুর', districtId: 'Tangail' },
  { id: 'Kalihati', name: 'Kalihati', bn: 'কালিহাতী', districtId: 'Tangail' },
  { id: 'Madhupur', name: 'Madhupur', bn: 'মধুপুর', districtId: 'Tangail' },
  { id: 'Mirzapur', name: 'Mirzapur', bn: 'মির্জাপুর', districtId: 'Tangail' },
  { id: 'Nagarpur', name: 'Nagarpur', bn: 'নাগরপুর', districtId: 'Tangail' },
  { id: 'Sakhipur', name: 'Sakhipur', bn: 'সখিপুর', districtId: 'Tangail' },
  { id: 'Tangail Sadar', name: 'Tangail Sadar', bn: 'টাঙ্গাইল সদর', districtId: 'Tangail' },

  // Thakurgaon District

  {
    id: 'Thakurgaon Sadar',
    name: 'Thakurgaon Sadar',
    bn: 'ঠাকুরগাঁও সদর',
    districtId: 'Thakurgaon',
  },
  { id: 'Baliadangi', name: 'Baliadangi', bn: 'বালিয়াডাঙ্গী', districtId: 'Thakurgaon' },
  { id: 'Haripur', name: 'Haripur', bn: 'হরিপুর', districtId: 'Thakurgaon' },
  { id: 'Pirganj', name: 'Pirganj', bn: 'পীরগঞ্জ', districtId: 'Thakurgaon' },
  { id: 'Ranisankail', name: 'Ranisankail', bn: 'রানীশংকৈল', districtId: 'Thakurgaon' },

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
