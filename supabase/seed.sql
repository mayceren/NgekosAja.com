-- Master only: safe without any Auth accounts, safe to replay. No credentials.
insert into public.facilities(code,name) values
 ('wifi','WiFi'),('ac','AC'),('private_bathroom','Kamar mandi dalam'),
 ('furniture','Furnitur'),('shared_kitchen','Dapur bersama'),('parking','Parkir'),('laundry','Laundry')
on conflict(code) do nothing;
