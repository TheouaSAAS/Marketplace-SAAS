-- =============================================================================
-- Niveau 24 : notifications (dédoublonnage, file d'envoi, préférences par
-- canal, messages, demandes, relances d'expiration, confirmation, alertes).
-- Exécuté sur la vraie base dans une transaction annulée (npm run db:verify).
-- =============================================================================
begin;

create temp table results (n serial, test text, ok boolean, detail text);
grant all on results to anon, authenticated;
grant usage on sequence results_n_seq to anon, authenticated;

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
end $$;
create function pg_temp.back() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.record(p_test text, p_ok boolean, p_detail text default null) returns void language sql as $$
  insert into results (test, ok, detail) values (p_test, coalesce(p_ok, false), p_detail);
$$;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000002401', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vendeur24@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002402', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'acheteur24@test.invalid', '{}', now(), now(), now()),
  ('00000000-0000-4000-8000-000000002403', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nonconfirme24@test.invalid', '{}', now(), now(), null);
update public.profiles set display_name = 'Zqn Acheteur' where id = '00000000-0000-4000-8000-000000002402';

do $$
declare
  v_city uuid := (select id from public.cities where is_default);
  v_seller uuid := '00000000-0000-4000-8000-000000002401';
  v_buyer uuid := '00000000-0000-4000-8000-000000002402';
  v_unconfirmed uuid := '00000000-0000-4000-8000-000000002403';
  v_listing uuid; v_far uuid; v_conversation uuid; v_saved uuid; v_notification uuid; v_delivery uuid;
  v_err text; n int; v_text text; v_bool boolean; v_until timestamptz;
begin
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision)
  values (v_seller, 'zqn-velo', 'Zqn Vélo à vendre', repeat('Description de test. ', 3), (select id from public.categories where slug = 'immobilier-location'),
          v_city, 'published', extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact')
  returning id into v_listing;
  update public.listings set expires_at = now() + interval '2 days' where id = v_listing;
  insert into public.listings (owner_id, slug, title, description, category_id, city_id, status, location, location_precision)
  values (v_seller, 'zqn-loin', 'Zqn Annonce lointaine', repeat('Description de test. ', 3), (select id from public.categories where slug = 'immobilier-location'),
          v_city, 'published', extensions.st_setsrid(extensions.st_makepoint(-6.63, 4.75), 4326)::extensions.geography, 'exact')
  returning id into v_far;

  -- Messages : une seule notification non lue par conversation
  perform pg_temp.act_as(v_buyer);
  v_conversation := public.start_listing_conversation(v_listing, 'Bonjour, est-il disponible ?');
  insert into public.messages (conversation_id, sender_id, body) values (v_conversation, v_buyer, 'Je peux passer demain.');
  perform pg_temp.back();
  select count(*), max(title), max(coalesce(body, '')) into n, v_text, v_err from public.notifications where user_id = v_seller and type = 'message';
  perform pg_temp.record('deux messages d''affilée : une seule notification, sans le contenu du message',
    n = 1 and v_text = 'Nouveau message de Zqn Acheteur' and v_err = '', n || ' / ' || coalesce(v_text, '-'));

  -- File d'envoi
  select id into v_notification from public.notifications where user_id = v_seller and type = 'message';
  select count(*) into n from public.notification_deliveries where notification_id = v_notification and channel = 'email' and status = 'pending';
  perform pg_temp.record('la notification part dans la file d''envoi par e-mail', n = 1, n::text);
  insert into public.notifications (user_id, type, title) values (v_unconfirmed, 'annonce', 'Zqn décision');
  select count(*) into n from public.notification_deliveries where user_id = v_unconfirmed;
  perform pg_temp.record('aucun e-mail vers une adresse non confirmée', n = 0, n::text);

  insert into public.user_preferences (user_id, notification_channels) values (v_buyer, '{"message": {"email": false}, "rappel": {"site": false}}')
  on conflict (user_id) do update set notification_channels = excluded.notification_channels;
  insert into public.notifications (user_id, type, title) values (v_buyer, 'message', 'Zqn message coupé par e-mail');
  select count(*) into n from public.notification_deliveries d join public.notifications x on x.id = d.notification_id where x.title = 'Zqn message coupé par e-mail';
  perform pg_temp.record('une catégorie coupée par e-mail reste visible sur le site, sans e-mail', n = 0 and exists (select 1 from public.notifications where title = 'Zqn message coupé par e-mail'), n::text);
  insert into public.notifications (user_id, type, title) values (v_buyer, 'rappel', 'Zqn rappel coupé');
  perform pg_temp.record('une catégorie coupée sur le site n''est pas créée', not exists (select 1 from public.notifications where title = 'Zqn rappel coupé'));
  update public.user_preferences set notification_channels = '{"_email": {"off": true}}' where user_id = v_buyer;
  insert into public.notifications (user_id, type, title) values (v_buyer, 'annonce', 'Zqn décision sans e-mail');
  select count(*) into n from public.notification_deliveries d join public.notifications x on x.id = d.notification_id where x.title = 'Zqn décision sans e-mail';
  perform pg_temp.record('« aucun e-mail » coupe aussi les décisions par e-mail', n = 0, n::text);
  update public.user_preferences set notification_channels = '{"annonce": {"site": false}}' where user_id = v_buyer;
  insert into public.notifications (user_id, type, title) values (v_buyer, 'annonce', 'Zqn décision toujours affichée');
  perform pg_temp.record('une décision de l''équipe reste toujours affichée sur le site', exists (select 1 from public.notifications where title = 'Zqn décision toujours affichée'));

  perform pg_temp.act_as(v_seller);
  select count(*) into n from public.notification_deliveries;
  perform pg_temp.record('la file d''envoi est illisible pour un membre', n = 0, n::text);
  v_err := null;
  begin
    perform * from public.claim_notification_deliveries(10);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('seul le serveur réserve des envois', v_err = '42501', v_err);
  perform pg_temp.back();

  update public.notification_deliveries set next_attempt_at = now() + interval '1 day' where notification_id <> v_notification and status = 'pending';
  select delivery_id, email into v_delivery, v_text from public.claim_notification_deliveries(500) where notification_id = v_notification;
  perform pg_temp.record('un envoi réservé porte l''adresse du destinataire', v_delivery is not null and v_text = 'vendeur24@test.invalid', coalesce(v_text, '-'));
  select count(*) into n from public.claim_notification_deliveries(500) where notification_id = v_notification;
  perform pg_temp.record('un envoi réservé ne l''est pas deux fois', n = 0, n::text);
  perform public.complete_notification_delivery(v_delivery, 'failed', 'http_503');
  select status || ':' || attempts || ':' || last_error into v_text from public.notification_deliveries where id = v_delivery;
  perform pg_temp.record('un échec est retenté plus tard, erreur journalisée', v_text = 'pending:1:http_503'
    and (select next_attempt_at > now() from public.notification_deliveries where id = v_delivery), v_text);
  update public.notification_deliveries set attempts = 5, status = 'sending' where id = v_delivery;
  perform public.complete_notification_delivery(v_delivery, 'failed', 'http_503');
  perform pg_temp.record('après 5 essais, l''envoi est abandonné', (select status from public.notification_deliveries where id = v_delivery) = 'failed');
  insert into public.notification_deliveries (notification_id, user_id, channel) values (v_notification, v_seller, 'email') on conflict do nothing;
  select count(*) into n from public.notification_deliveries where notification_id = v_notification and channel = 'email';
  perform pg_temp.record('jamais deux envois e-mail pour une même notification', n = 1, n::text);

  -- Demandes de contact
  perform pg_temp.act_as(v_buyer);
  insert into public.contact_requests (listing_id, sender_id, sender_name, sender_phone, message, kind, consented_at, recipient_id)
  values (v_listing, v_buyer, 'Zqn Client', '0700000024', 'Est-ce négociable ?', 'contact', now(), v_buyer);
  perform pg_temp.back();
  perform pg_temp.record('une demande de contact prévient son destinataire',
    exists (select 1 from public.notifications where user_id = v_seller and type = 'demande' and body like 'De Zqn Client%'));

  -- Relances d'expiration
  perform public.notify_expiring_listings();
  perform public.notify_expiring_listings();
  select count(*) into n from public.notifications where user_id = v_seller and type = 'expiration' and title like '%Zqn Vélo%';
  perform pg_temp.record('une annonce qui expire bientôt est relancée une seule fois', n = 1, n::text);
  select count(*) into n from public.notifications where user_id = v_seller and type = 'expiration' and title like '%Zqn Annonce lointaine%';
  perform pg_temp.record('pas de relance loin de l''échéance', n = 0, n::text);

  perform pg_temp.act_as(v_buyer);
  v_err := null;
  begin
    perform public.confirm_listing(v_listing);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('seul l''auteur confirme son annonce', v_err = 'P0002', v_err);
  perform pg_temp.back();
  perform pg_temp.act_as(v_seller);
  v_err := null;
  begin
    perform public.confirm_listing(v_far);
  exception when others then v_err := sqlstate;
  end;
  perform pg_temp.record('une annonce loin de son échéance ne se confirme pas encore', v_err = '23514', v_err);
  v_until := public.confirm_listing(v_listing);
  perform pg_temp.back();
  select status = 'published' and expires_at = v_until and expires_at > now() + interval '30 days' and last_confirmed_at is not null into v_bool from public.listings where id = v_listing;
  perform pg_temp.record('la confirmation prolonge l''annonce sans la renvoyer en modération', v_bool);

  -- Alertes de recherche
  insert into public.saved_searches (user_id, name, query, alert_frequency) values (v_buyer, 'Zqn vélos', '{"search": "type=annonces&q=velo", "version": 1}', 'daily') returning id into v_saved;
  v_bool := public.record_search_alert(v_saved, 2, '2 nouvelles annonces pour « Zqn vélos »', '/recherche?type=annonces&q=velo');
  perform pg_temp.record('une alerte de recherche crée une notification prudente', v_bool
    and exists (select 1 from public.notifications where user_id = v_buyer and type = 'recherche' and body like 'Contenus publiés par leurs auteurs%'));
  v_bool := public.record_search_alert(v_saved, 3, '3 nouvelles annonces pour « Zqn vélos »', '/recherche?type=annonces&q=velo');
  select count(*) into n from public.notifications where user_id = v_buyer and type = 'recherche';
  perform pg_temp.record('au plus une alerte par recherche et par jour', not v_bool and n = 1, n::text);
  v_bool := public.record_search_alert(v_saved, 0, 'rien', '/recherche');
  perform pg_temp.record('sans nouveauté, aucune alerte mais la recherche est marquée', not v_bool
    and (select last_alerted_at > now() - interval '1 minute' from public.saved_searches where id = v_saved));
end $$;

select test, ok, detail from results order by n;
rollback;
