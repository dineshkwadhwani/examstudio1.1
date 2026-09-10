#!/usr/bin/env node
/**
 * Task 3 Spreadsheet Generator
 * ─────────────────────────────
 * Reads the student roster from 002_ca1_seed.sql (or a CSV) and assigns
 * an Indian city to each student, seeded by PRN for determinism.
 * Outputs a CSV ready to upload to Google Sheets.
 *
 * Run: npx ts-node --project tsconfig.node.json scripts/generate-spreadsheet.ts
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ─── Indian cities with lat/lon ───────────────────────────────
const CITIES = [
  { city: 'Mumbai',       lat: 19.0760,  lon: 72.8777  },
  { city: 'Delhi',        lat: 28.7041,  lon: 77.1025  },
  { city: 'Bangalore',    lat: 12.9716,  lon: 77.5946  },
  { city: 'Hyderabad',    lat: 17.3850,  lon: 78.4867  },
  { city: 'Ahmedabad',    lat: 23.0225,  lon: 72.5714  },
  { city: 'Chennai',      lat: 13.0827,  lon: 80.2707  },
  { city: 'Kolkata',      lat: 22.5726,  lon: 88.3639  },
  { city: 'Pune',         lat: 18.5204,  lon: 73.8567  },
  { city: 'Jaipur',       lat: 26.9124,  lon: 75.7873  },
  { city: 'Lucknow',      lat: 26.8467,  lon: 80.9462  },
  { city: 'Kanpur',       lat: 26.4499,  lon: 80.3319  },
  { city: 'Nagpur',       lat: 21.1458,  lon: 79.0882  },
  { city: 'Indore',       lat: 22.7196,  lon: 75.8577  },
  { city: 'Thane',        lat: 19.2183,  lon: 72.9781  },
  { city: 'Bhopal',       lat: 23.2599,  lon: 77.4126  },
  { city: 'Visakhapatnam',lat: 17.6868,  lon: 83.2185  },
  { city: 'Pimpri',       lat: 18.6298,  lon: 73.7997  },
  { city: 'Patna',        lat: 25.5941,  lon: 85.1376  },
  { city: 'Vadodara',     lat: 22.3072,  lon: 73.1812  },
  { city: 'Ghaziabad',    lat: 28.6692,  lon: 77.4538  },
  { city: 'Ludhiana',     lat: 30.9010,  lon: 75.8573  },
  { city: 'Agra',         lat: 27.1767,  lon: 78.0081  },
  { city: 'Nashik',       lat: 20.0059,  lon: 73.7903  },
  { city: 'Faridabad',    lat: 28.4089,  lon: 77.3178  },
  { city: 'Meerut',       lat: 28.9845,  lon: 77.7064  },
  { city: 'Rajkot',       lat: 22.3039,  lon: 70.8022  },
  { city: 'Varanasi',     lat: 25.3176,  lon: 82.9739  },
  { city: 'Srinagar',     lat: 34.0837,  lon: 74.7973  },
  { city: 'Aurangabad',   lat: 19.8762,  lon: 75.3433  },
  { city: 'Amritsar',     lat: 31.6340,  lon: 74.8723  },
  { city: 'Ranchi',       lat: 23.3441,  lon: 85.3096  },
  { city: 'Coimbatore',   lat: 11.0168,  lon: 76.9558  },
  { city: 'Mysore',       lat: 12.2958,  lon: 76.6394  },
  { city: 'Guwahati',     lat: 26.1445,  lon: 91.7362  },
  { city: 'Chandigarh',   lat: 30.7333,  lon: 76.7794  },
  { city: 'Thiruvananthapuram', lat: 8.5241, lon: 76.9366 },
  { city: 'Kochi',        lat: 9.9312,   lon: 76.2673  },
  { city: 'Bhubaneswar',  lat: 20.2961,  lon: 85.8245  },
  { city: 'Raipur',       lat: 21.2514,  lon: 81.6296  },
  { city: 'Dehradun',     lat: 30.3165,  lon: 78.0322  },
  { city: 'Jodhpur',      lat: 26.2389,  lon: 73.0243  },
  { city: 'Madurai',      lat: 9.9252,   lon: 78.1198  },
  { city: 'Tiruchirappalli', lat: 10.7905, lon: 78.7047 },
  { city: 'Jabalpur',     lat: 23.1815,  lon: 79.9864  },
  { city: 'Gwalior',      lat: 26.2183,  lon: 78.1828  },
  { city: 'Vijayawada',   lat: 16.5062,  lon: 80.6480  },
  { city: 'Hubli',        lat: 15.3647,  lon: 75.1240  },
  { city: 'Amravati',     lat: 20.9374,  lon: 77.7796  },
  { city: 'Bikaner',      lat: 28.0229,  lon: 73.3119  },
  { city: 'Noida',        lat: 28.5355,  lon: 77.3910  },
]

// ─── Roster ───────────────────────────────────────────────────
// Loaded from the seed SQL roster. Add/remove as needed.
const ROSTER = [
  { prn: '23070122004', name: 'Aarohi Kondpalle' },
  { prn: '23070122253', name: 'Aarvee Sunil Wadhwa' },
  { prn: '23070122005', name: 'Aarya Balwadkar' },
  { prn: '23070122006', name: 'Aaryan Nagu' },
  { prn: '23070122007', name: 'Aashi Joshi' },
  { prn: '23070122008', name: 'Aayush Joshi' },
  { prn: '23070122009', name: 'Abdulelah Faisal Alolofi' },
  { prn: '23070122010', name: 'Abhay Pandey' },
  { prn: '23070122011', name: 'Abhilaksh Saini' },
  { prn: '23070122012', name: 'Abhirami Nair' },
  { prn: '23070122268', name: 'Abhyudaya Dixit' },
  { prn: '23070122261', name: 'Adarsh Jha' },
  { prn: '23070122013', name: 'Aditi Bansal' },
  { prn: '23070122016', name: 'Aditya Tiwari' },
  { prn: '23070122017', name: 'Afifa Bintul Hasan' },
  { prn: '23070122018', name: 'Ahmed Mohammed' },
  { prn: '23070122020', name: 'Akushie John Chinonso' },
  { prn: '23070122276', name: 'Alaa Sokhni' },
  { prn: '23070122021', name: 'Alan Joseph Kurian' },
  { prn: '23070122274', name: 'Ali Almubarak' },
  { prn: '23070122022', name: 'Ali Naif Mohsen Ali Al-Tam' },
  { prn: '23070122023', name: 'Aliraza Shaikh' },
  { prn: '23070122024', name: 'Aman Srivastava' },
  { prn: '23070122025', name: 'Aman Vats' },
  { prn: '23070122027', name: 'Anagha Premlal Nair' },
  { prn: '23070122029', name: 'Ananya Poundrik' },
  { prn: '23070122246', name: 'Anish Kumar Sah' },
  { prn: '23070122032', name: 'Ankush Dutta' },
  { prn: '23070122033', name: 'Anshul Ravindra Mandekar' },
  { prn: '23070122034', name: 'Anum Agrawal' },
  { prn: '23070122035', name: 'Anushka Desai' },
  { prn: '23070122262', name: 'Anushka Tandon' },
  { prn: '23070122038', name: 'Anvesha Singh' },
  { prn: '23070122040', name: 'Aparna Nair' },
  { prn: '23070122041', name: 'Archisha Yadav' },
  { prn: '23070122042', name: 'Archishmaan Singh Rohal' },
  { prn: '24070122505', name: 'Arnav Jhodge' },
  { prn: '23070122046', name: 'Arnav Karole' },
  { prn: '23070122044', name: 'Arnav Krishna Bhardwaj' },
  { prn: '23070122045', name: 'Arnav Niteen More' },
  { prn: '23070122047', name: 'Arsh Ansari' },
  { prn: '23070122048', name: 'Arun Tati' },
  { prn: '23070122049', name: 'Arunabha Mukhopadhyay' },
  { prn: '23070122050', name: 'Arya Sanjay Bhirud' },
  { prn: '24070122501', name: 'Aryan Bhandage' },
  { prn: '23070122052', name: 'Aryan Choudhary' },
  { prn: '23070122053', name: 'Aryan Kumar' },
  { prn: '23070122054', name: 'Aryan Sahare' },
  { prn: '23070122055', name: 'Aryan Srivastava' },
  { prn: '23070122058', name: 'Ashwin Sadashiv Laad' },
  { prn: '23070122059', name: 'Astha Kumari' },
  { prn: '24070122519', name: 'Atharva Kulkarni' },
  { prn: '23070122174', name: 'Atharva Rale' },
  { prn: '24070122502', name: 'Atharva Sunil Khanorkar' },
  { prn: '23070122060', name: 'Avi S Gupta' },
  { prn: '23070122061', name: 'Aviraj Yadav' },
  { prn: '23070122063', name: 'Ayaan Rukadikar' },
  { prn: '23070122064', name: 'Ayan Irufanoddin Shaikh' },
  { prn: '23070122066', name: 'Ayush Siddhant' },
  { prn: '23070122067', name: 'Baboucarr Sonko' },
  { prn: '23070122068', name: 'Bandopadhyaya Anindita' },
  { prn: '23070122070', name: 'Bhagyesh Sutar' },
  { prn: '23070122072', name: 'Bhumi Asati' },
  { prn: '23070122249', name: 'Bokhit Mahamat Tom' },
  { prn: '23070122077', name: 'Chintan Kumar Pradhan' },
  { prn: '23070122079', name: 'Daneti Jagananmol' },
  { prn: '23070122080', name: 'Deep Shah' },
  { prn: '23070122081', name: 'Deepti Pal' },
  { prn: '24070122517', name: 'Dev Vachhani' },
  { prn: '23070122082', name: 'Devadhath Kodavamparambil Dileep' },
  { prn: '23070122083', name: 'Devaki Joshi' },
  { prn: '23070122271', name: 'Devank Upadhyaya' },
  { prn: '23070122084', name: 'Devashree Abhay Kale' },
  { prn: '23070122085', name: 'Dhawse Spandan Yashwant' },
  { prn: '23070122258', name: 'Dhruv Gupta' },
  { prn: '23070122086', name: 'Diksha Jha' },
  { prn: '23070122087', name: 'Dossoumidokpe Jay Rickier Vyanel Fadonougbo' },
  { prn: '23070122088', name: 'Drishti Mundhara' },
  { prn: '23070122089', name: 'Dushyant Singh Chouhan' },
  { prn: '23070122264', name: 'Eccha Bansal Agrawal' },
  { prn: '23070122090', name: 'Ganapathy Raman Anirudh' },
  { prn: '23070122091', name: 'Gangurde Dhruv Deepak' },
  { prn: '23070122092', name: 'Garv Bhalla' },
  { prn: '23070122094', name: 'Garvit Tyagi' },
  { prn: '23070122114', name: 'Gaud Kashyup Pawan' },
  { prn: '23070122095', name: 'Gauri Singh' },
  { prn: '23070122096', name: 'Gayatri Patil' },
  { prn: '23070122154', name: 'Ghule Om Ajit' },
  { prn: '23070122098', name: 'Gunveer Singh' },
  { prn: '23070122099', name: 'Gurunarayan Vajpayee' },
  { prn: '23070122100', name: 'Harsh Ledwani' },
  { prn: '23070122102', name: 'Harsh Rajput' },
  { prn: '23070122101', name: 'Harsh Raju Mate' },
  { prn: '23070122103', name: 'Harshada Padma Mahamkali' },
  { prn: '23070122106', name: 'Ishan Sinha' },
  { prn: '23070122269', name: 'Ishita Agarwal' },
  { prn: '23070122108', name: 'Janak Fabyani' },
  { prn: '24070122504', name: 'Jasani Het Arvind' },
  { prn: '23070122109', name: 'Jayant Puri' },
  { prn: '23070122243', name: 'Jesline Pinto' },
  { prn: '23070122111', name: 'Jiya Tyagi' },
  { prn: '23070122112', name: 'Joshua Bara' },
  { prn: '23070122278', name: 'Jyoti Kumari Sah' },
  { prn: '23070122113', name: 'Kapure Shivam Sahebrao' },
  { prn: '24070122503', name: 'Karan Desai' },
  { prn: '23070122126', name: 'Kazi Maazin Azim' },
  { prn: '24070122506', name: 'Kendre Ganraj Ashok' },
  { prn: '23070122116', name: 'Kisna Kanti' },
  { prn: '23070122118', name: 'Kritika Nair' },
  { prn: '23070122119', name: 'Krittika Bisht' },
  { prn: '23070122121', name: 'Kshitij Shah' },
  { prn: '23070122122', name: 'Kushagra' },
  { prn: '23070122267', name: 'Kushbu Niraj Agrawal' },
  { prn: '23070122123', name: 'L S Pragun' },
  { prn: '23070122075', name: 'Lakshita Ravindra Chaudhari' },
  { prn: '23070122124', name: 'Lakshya Jain' },
  { prn: '23070122260', name: 'Lauriane Lenge Wa Mpitshi' },
  { prn: '23070122125', name: 'Laxmi Kumari Sah' },
  { prn: '23070122127', name: 'Madhura Parag Panvelkar' },
  { prn: '23070122128', name: 'Mahi Sharma' },
  { prn: '23070122129', name: 'Mahmoud Mohammed Mahmoud Masawa AlAidaros' },
  { prn: '24070122507', name: 'Malhar Borse' },
  { prn: '23070122132', name: 'Manav Dalwani' },
  { prn: '23070122134', name: 'Mayank Bansal' },
  { prn: '23070122135', name: 'Mayank Rajesh Hete' },
  { prn: '23070122265', name: 'Mithlesh Yadav' },
  { prn: '23070122138', name: 'Mitiksha Paliwal' },
  { prn: '23070122275', name: 'Modar Alshoufi' },
  { prn: '23070122139', name: 'Mohak Sareen' },
  { prn: '23070122140', name: 'Mohammad Ahmad' },
  { prn: '23070122141', name: 'Mohammed Al Hajj' },
  { prn: '23070122142', name: 'Mohnish Kundnani' },
  { prn: '24070122508', name: 'More Atharva Uttamrao' },
  { prn: '24070122509', name: 'More Sejal Sanjay' },
  { prn: '23070122250', name: 'Mourno Mahamat Issack Mandi' },
  { prn: '23070122143', name: 'Muskan Sahay' },
  { prn: '23070122279', name: 'Muskan Shah' },
  { prn: '23070122144', name: 'Nair Sreehari Sathyan' },
  { prn: '23070122147', name: 'Nedha Nizamudeen' },
  { prn: '24070122510', name: 'Neel Somnath Khule' },
  { prn: '23070122148', name: 'Nigel Francy Vallachirakkaran' },
  { prn: '23070122149', name: 'Nilabjo Goswami' },
  { prn: '23070122259', name: 'Nimita Jestin' },
  { prn: '23070122150', name: 'Nitesh Ghimire' },
  { prn: '23070122151', name: 'Niyati Dave' },
  { prn: '23070122153', name: 'Ojas Verma' },
  { prn: '23070122155', name: 'Om Shivshankar Dhamame' },
  { prn: '23070122157', name: 'Omar Abdalrahman' },
  { prn: '23070122156', name: 'Omayr Muqarrab Yunus' },
  { prn: '23070122245', name: 'Omika Shrestha' },
  { prn: '23070122158', name: 'Omkar Kadam' },
  { prn: '24070122511', name: 'Pandit Nihil Sunilbhai' },
  { prn: '23070122161', name: 'Parth Niranjan Damle' },
  { prn: '23070122110', name: 'Patel Jeel Bhaveshbhai' },
  { prn: '23070122280', name: 'Prabin Yadav' },
  { prn: '23070122163', name: 'Prajyot Vedante' },
  { prn: '23070122252', name: 'Pratik Kumar Chaudhary' },
  { prn: '23070122166', name: 'Pratik Lakra' },
  { prn: '23070122167', name: 'Pritika Anand Kurup' },
  { prn: '23070122168', name: 'Priyansh Kabra' },
  { prn: '23070122169', name: 'Pushkraj P Naik' },
  { prn: '23070122170', name: 'Raghav Dhoot' },
  { prn: '23070122172', name: 'Raghav Hitesh Sonchhatra' },
  { prn: '23070122171', name: 'Raghav Sharma' },
  { prn: '23070122173', name: 'Rajat Singh' },
  { prn: '24070122512', name: 'Rajnandini Kathote' },
  { prn: '23070122175', name: 'Rathod Deepak Raju' },
  { prn: '23070122176', name: 'Ravi Kumar Sharma' },
  { prn: '23070122177', name: 'Reeti Agarwal' },
  { prn: '23070122178', name: 'Reuel Menon' },
  { prn: '23070122179', name: 'Ria Vinod' },
  { prn: '23070122180', name: 'Rishi Modi' },
  { prn: '23070122181', name: 'Rishi Saxena' },
  { prn: '23070122183', name: 'Rishika Arora' },
  { prn: '23070122184', name: 'Riya Agrawal' },
  { prn: '24070122513', name: 'Rudra Rajendra Khandelwal' },
  { prn: '23070122186', name: 'Rut Vaghani' },
  { prn: '23070122247', name: 'Saara Jagdale' },
  { prn: '23070122073', name: 'Sahoo Bishwajeet Laxman' },
  { prn: '23070122189', name: 'Samartha Shrestha' },
  { prn: '23070122191', name: 'Sameer Shekhar' },
  { prn: '23070122192', name: 'Sanidhya Rajendra Awasthi' },
  { prn: '23070122193', name: 'Sanskriti Shrivastava' },
  { prn: '23070122194', name: 'Sanyukt Ramola' },
  { prn: '23070122273', name: 'Sara Suleiman' },
  { prn: '23070122277', name: 'Sashank Karn' },
  { prn: '23070122195', name: 'Saumya Kumar' },
  { prn: '23070122196', name: 'Sayyed Faheemuddin Muqeemuddin' },
  { prn: '23070122051', name: 'Shah Arya Amit' },
  { prn: '24070122514', name: 'Shantanu Doifode' },
  { prn: '23070122197', name: 'Shanvi Srivastava' },
  { prn: '23070122198', name: 'Shashank Singh' },
  { prn: '23070122202', name: 'Sheladia Aryan Ashish' },
  { prn: '23070122203', name: 'Shivam Bhartiya' },
  { prn: '23070122205', name: 'Shreyansh Suresh Saboo' },
  { prn: '23070122214', name: 'Shreyash Sure' },
  { prn: '23070122263', name: 'Shrivali Dutt' },
  { prn: '23070122206', name: 'Shubhankar Sarangi' },
  { prn: '23070122266', name: 'Sonali Gupta' },
  { prn: '23070122207', name: 'Sonalika Singha' },
  { prn: '23070122208', name: 'Soni Saumya Jaideep' },
  { prn: '23070122209', name: 'Soniya Pandey' },
  { prn: '23070122210', name: 'Soumyadev Adhikary' },
  { prn: '23070122257', name: 'Sourav Singh' },
  { prn: '23070122212', name: 'Sujit Nitin Gunjal' },
  { prn: '23070122244', name: 'Sujit Singh' },
  { prn: '23070122213', name: 'Sukaran Singh' },
  { prn: '23070122255', name: 'Sumit Pathak' },
  { prn: '23070122215', name: 'Sushant Kumar Yadav' },
  { prn: '23070122216', name: 'Swarali Dhananjay Bhalerao' },
  { prn: '23070122218', name: 'Tanisha Sirohi' },
  { prn: '23070122220', name: 'Tanishka Tanaji Mane' },
  { prn: '24070122515', name: 'Tanmay Sunil Salunkhe' },
  { prn: '23070122221', name: 'Tanvee Kirankumar Patil' },
  { prn: '23070122222', name: 'Tej Narayan Sah' },
  { prn: '23070122223', name: 'Tiparadi Amit Avinash' },
  { prn: '23070122224', name: 'Tisha Malkani' },
  { prn: '24070122516', name: 'Trivedi Harsh Prahoshbhai' },
  { prn: '23070122256', name: 'Utsav Raj Singh' },
  { prn: '23070122227', name: 'Uttkarsh Ruparel' },
  { prn: '23070122228', name: 'Vanshika Dhawan' },
  { prn: '23070122229', name: 'Vedant Chavle' },
  { prn: '23070122230', name: 'Vedant Nair' },
  { prn: '23070122231', name: 'Vedika Kodgire' },
  { prn: '23070122232', name: 'Velagala Prapul Krishna Reddy' },
  { prn: '23070122074', name: 'Viraj Sheoran' },
  { prn: '23070122234', name: 'Yash Pandey' },
  { prn: '23070122235', name: 'Yash Patel' },
  { prn: '23070122236', name: 'Yashmit Kotekar' },
  { prn: '23070122237', name: 'Yashraj Shrivastava' },
  { prn: '23070122238', name: 'Yudhveer' },
  { prn: '23070122239', name: 'Yug Choubey' },
  // Dinesh Wadhwani — Indore is hardcoded
  { prn: '1234', name: 'Dinesh Wadhwani' },
]

// ─── Assign city by PRN seed ──────────────────────────────────
function assignCity(prn: string): typeof CITIES[0] {
  // Special case: Dinesh gets Indore
  if (prn === '1234') return CITIES.find(c => c.city === 'Indore')!

  const hash = crypto.createHash('sha256').update(`city:${prn}`).digest('hex')
  const n = parseInt(hash.slice(0, 8), 16)
  // Don't assign Pune to students (it's visible out the window!)
  const pool = CITIES.filter(c => c.city !== 'Pune')
  return pool[n % pool.length]
}

async function main() {
  const rows = ROSTER.map(student => {
    const city = assignCity(student.prn)
    return {
      prn: student.prn,
      name: student.name,
      city: city.city,
      latitude: city.lat,
      longitude: city.lon,
    }
  })

  // Sort by PRN
  rows.sort((a, b) => a.prn.localeCompare(b.prn))

  // Build CSV
  const header = 'PRN,Name,City,Latitude,Longitude'
  const lines = rows.map(r =>
    // Quote fields that might contain commas
    `"${r.prn}","${r.name}","${r.city}",${r.latitude},${r.longitude}`
  )
  const csv = [header, ...lines].join('\n')

  const outPath = path.join(process.cwd(), 'scripts', 'task3-spreadsheet.csv')
  fs.writeFileSync(outPath, csv, 'utf8')

  console.log(`\n✅ Task 3 Spreadsheet generated`)
  console.log(`   Output: ${outPath}`)
  console.log(`   Rows: ${rows.length}`)
  console.log(`\nCities assigned:`)
  const cityCounts = new Map<string, number>()
  rows.forEach(r => cityCounts.set(r.city, (cityCounts.get(r.city) ?? 0) + 1))
  ;[...cityCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([city, count]) => console.log(`   ${city}: ${count} students`))

  console.log(`\nNext steps:`)
  console.log(`  1. Open Google Sheets → File → Import → upload task3-spreadsheet.csv`)
  console.log(`  2. Share the sheet as "Anyone with link can view"`)
  console.log(`  3. Get the CSV export URL:`)
  console.log(`     File → Share → Publish to web → .csv format → copy the link`)
  console.log(`     OR manually: https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv&gid=0`)
  console.log(`  4. Paste this URL when creating the exam session in the SA Dashboard`)
}

main().catch(console.error)
