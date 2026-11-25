import type { Language } from "./roast";

/**
 * Deliberately terrible code, one sample per language. Every sample is written
 * to trip the rules that matter for that language, so "Load sample" always
 * demonstrates something real about the language you picked.
 */
const SAMPLE_JS = `var API_KEY = "sk_live_9f2b7c41aa8e4d3f";
var users = [];

function getUser(id) {
  var q = "SELECT * FROM users WHERE id = " + id;
  var res = db.query(q);
  if (res == null) {
    try {
      return JSON.parse(eval("(" + res + ")"));
    } catch (e) {}
  }
  for (var i = 0; i < res.length; i++) {
    for (var j = 0; j < res[i].items.length; j++) {
      for (var k = 0; k < res[i].items[j].tags.length; k++) {
        if (res[i].items[j].tags[k] == "vip") {
          if (res[i].items[j].price > 100) {
            if (res[i].items[j].stock != 0) {
              users.push(res[i].items[j]);
            }
          }
        }
      }
    }
  }
  document.getElementById("out").innerHTML = res;
  console.log("got users", users);
  console.log("count", users.length);
  console.log("done");
  console.log("really done");
  // return users;
  // users = [];
  return users;
}

function getUserAgain(id) {
  var q = "SELECT * FROM users WHERE id = " + id;
  var res = db.query(q);
  return res;
}

// TODO: fix this before launch
// FIXME: actually fix it
`;

const SAMPLE_TS = `interface User {
  id: any;
  name: any;
  email: any;
}

export class UserService {
  private db: any;
  private cache: any;

  constructor(db: any) {
    this.db = db;
    this.cache = {};
  }

  async getUser(id: any): Promise<any> {
    const cached = this.cache[id];
    if (cached != null) {
      return cached;
    }
    const row = await this.db.query("SELECT * FROM users WHERE id = " + id);
    const user = row as any;
    user.token = "gh-9f2b7c41aa8e4d3f";
    this.cache[id] = user;
    console.log("fetched", user);
    return user!;
  }

  async getAll(ids: any[]): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < ids.length; i++) {
      const u = await this.getUser(ids[i]);
      if (u != null) {
        out.push(u);
      }
    }
    return out;
  }

  // TODO: type this properly
  // const x = 1;
  // const y = 2;
  parse(raw: any): any {
    return JSON.parse(eval("(" + raw + ")"));
  }
}
`;

const SAMPLE_PYTHON = `import os
import json

API_KEY = "sk_live_9f2b7c41aa8e4d3f"

def get_user(id):
    q = "SELECT * FROM users WHERE id = " + id
    res = db.query(q)
    if res == None:
        try:
            return json.loads(eval(res))
        except:
            pass
    users = []
    for i in range(len(res)):
        for j in range(len(res[i]["items"])):
            for k in range(len(res[i]["items"][j]["tags"])):
                if res[i]["items"][j]["tags"][k] == "vip":
                    if res[i]["items"][j]["price"] > 100:
                        if res[i]["items"][j]["stock"] != 0:
                            users.append(res[i]["items"][j])
    print("got users", users)
    print("count", len(users))
    print("done")
    # return users
    # users = []
    return users

def get_user_again(id):
    q = "SELECT * FROM users WHERE id = " + id
    res = db.query(q)
    return res

# TODO: fix this before launch
# FIXME: actually fix it
`;

const SAMPLE_JAVA = `import java.util.*;

public class UserService {
    private static final String API_KEY = "sk_live_9f2b7c41aa8e4d3f";
    private List<User> users = new ArrayList<User>();

    public List<User> getUser(String id) {
        String q = "SELECT * FROM users WHERE id = " + id;
        ResultSet res = db.query(q);
        if (res == null) {
            try {
                return (List<User>) parse(eval(res));
            } catch (Exception e) {
            }
        }
        for (int i = 0; i < res.size(); i++) {
            for (int j = 0; j < res.get(i).items.size(); j++) {
                for (int k = 0; k < res.get(i).items.get(j).tags.size(); k++) {
                    if (res.get(i).items.get(j).tags.get(k) == "vip") {
                        if (res.get(i).items.get(j).price > 100) {
                            if (res.get(i).items.get(j).stock != 0) {
                                users.add(res.get(i).items.get(j));
                            }
                        }
                    }
                }
            }
        }
        System.out.println("got users " + users);
        System.out.println("count " + users.size());
        System.out.println("done");
        // return users;
        // users = new ArrayList<User>();
        return users;
    }

    // TODO: fix this before launch
    // FIXME: actually fix it
}
`;

const SAMPLE_CSHARP = `using System;
using System.Collections.Generic;

public class UserService
{
    private const string ApiKey = "sk_live_9f2b7c41aa8e4d3f";
    private List<User> users = new List<User>();

    public List<User> GetUser(string id)
    {
        string q = "SELECT * FROM users WHERE id = " + id;
        var res = db.Query(q);
        if (res == null)
        {
            try
            {
                return (List<User>)Parse(Eval(res));
            }
            catch (Exception e)
            {
            }
        }
        for (int i = 0; i < res.Count; i++)
        {
            for (int j = 0; j < res[i].Items.Count; j++)
            {
                for (int k = 0; k < res[i].Items[j].Tags.Count; k++)
                {
                    if (res[i].Items[j].Tags[k] == "vip")
                    {
                        if (res[i].Items[j].Price > 100)
                        {
                            if (res[i].Items[j].Stock != 0)
                            {
                                users.Add(res[i].Items[j]);
                            }
                        }
                    }
                }
            }
        }
        Console.WriteLine("got users " + users);
        Console.WriteLine("count " + users.Count);
        Console.WriteLine("done");
        // return users;
        // users = new List<User>();
        return users;
    }

    // TODO: fix this before launch
    // FIXME: actually fix it
}
`;

const SAMPLE_GO = `package main

import "fmt"

const apiKey = "sk_live_9f2b7c41aa8e4d3f"

func getUser(id string) []User {
	q := "SELECT * FROM users WHERE id = " + id
	res := db.Query(q)
	if res == nil {
		return nil
	}
	users := []User{}
	for i := 0; i < len(res); i++ {
		for j := 0; j < len(res[i].Items); j++ {
			for k := 0; k < len(res[i].Items[j].Tags); k++ {
				if res[i].Items[j].Tags[k] == "vip" {
					if res[i].Items[j].Price > 100 {
						if res[i].Items[j].Stock != 0 {
							users = append(users, res[i].Items[j])
						}
					}
				}
			}
		}
	}
	fmt.Println("got users", users)
	fmt.Println("count", len(users))
	fmt.Println("done")
	// return users
	// users = []User{}
	return users
}

// TODO: fix this before launch
// FIXME: actually fix it
`;

const SAMPLE_RUST = `use std::collections::HashMap;

const API_KEY: &str = "sk_live_9f2b7c41aa8e4d3f";

fn get_user(id: String) -> Vec<User> {
    let q = format!("SELECT * FROM users WHERE id = {}", id);
    let res = db.query(&q);
    let mut users = Vec::new();
    for i in 0..res.len() {
        for j in 0..res[i].items.len() {
            for k in 0..res[i].items[j].tags.len() {
                if res[i].items[j].tags[k] == "vip" {
                    if res[i].items[j].price > 100 {
                        if res[i].items[j].stock != 0 {
                            users.push(res[i].items[j].clone());
                        }
                    }
                }
            }
        }
    }
    println!("got users {:?}", users);
    println!("count {}", users.len());
    println!("done");
    // return users;
    // users = Vec::new();
    users
}

// TODO: fix this before launch
// FIXME: actually fix it
`;

const SAMPLE_PHP = `<?php
$api_key = "sk_live_9f2b7c41aa8e4d3f";
$users = array();

function getUser($id) {
    global $users;
    $q = "SELECT * FROM users WHERE id = " . $id;
    $res = db_query($q);
    if ($res == null) {
        try {
            return json_decode(eval("return " . $res . ";"));
        } catch (Exception $e) {
        }
    }
    for ($i = 0; $i < count($res); $i++) {
        for ($j = 0; $j < count($res[$i]["items"]); $j++) {
            for ($k = 0; $k < count($res[$i]["items"][$j]["tags"]); $k++) {
                if ($res[$i]["items"][$j]["tags"][$k] == "vip") {
                    if ($res[$i]["items"][$j]["price"] > 100) {
                        if ($res[$i]["items"][$j]["stock"] != 0) {
                            array_push($users, $res[$i]["items"][$j]);
                        }
                    }
                }
            }
        }
    }
    echo "got users";
    print_r($users);
    echo "done";
    // return $users;
    // $users = array();
    return $users;
}

// TODO: fix this before launch
// FIXME: actually fix it
`;

const SAMPLE_RUBY = `require 'json'

API_KEY = "sk_live_9f2b7c41aa8e4d3f"
$users = []

def get_user(id)
  q = "SELECT * FROM users WHERE id = " + id
  res = db.query(q)
  if res == nil
    begin
      return JSON.parse(eval(res))
    rescue
    end
  end
  for i in 0..res.length
    for j in 0..res[i]["items"].length
      for k in 0..res[i]["items"][j]["tags"].length
        if res[i]["items"][j]["tags"][k] == "vip"
          if res[i]["items"][j]["price"] > 100
            if res[i]["items"][j]["stock"] != 0
              $users.push(res[i]["items"][j])
            end
          end
        end
      end
    end
  end
  puts "got users"
  puts $users.length
  puts "done"
  # return $users
  # $users = []
  $users
end

# TODO: fix this before launch
# FIXME: actually fix it
`;

const SAMPLE_SQL = `SELECT u.id, u.name, u.email, u.password, u.api_key
FROM users u, orders o, order_items oi, products p
WHERE u.id = o.user_id
AND o.id = oi.order_id
AND oi.product_id = p.id
AND u.email LIKE '%@gmail.com'
AND (o.status = 'paid' OR o.status = 'pending' OR o.status = 'refunded')
AND p.price > 100
AND u.created_at > '2020-01-01'
ORDER BY u.created_at DESC;

SELECT * FROM users WHERE id = 1;

SELECT * FROM orders WHERE user_id = 1;

SELECT * FROM order_items WHERE order_id = 1;

SELECT * FROM products WHERE id = 1;

UPDATE users SET last_seen = NOW();

DELETE FROM sessions;

-- TODO: fix this before launch
-- FIXME: actually fix it
`;

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
  <script src="https://code.jquery.com/jquery-1.12.4.min.js"></script>
  <script src="http://cdn.example.com/old-lib.js"></script>
</head>
<body bgcolor="#ffffff">
  <center>
    <font color="red" size="6"><b>Welcome to my homepage!!!</b></font>
    <br/>
    <br/>
    <marquee>Best viewed in Netscape Navigator</marquee>
  </center>
  <table width="800" border="1" cellpadding="0" cellspacing="0">
    <tr>
      <td width="200" valign="top">
        <a href="#" onclick="doStuff(); return false;">Home</a>
        <a href="#" onclick="doOtherStuff()">About</a>
      </td>
      <td width="600">
        <img src="banner.gif">
        <img src="logo.png">
        <div style="color: red; font-size: 12px;" id="out"></div>
        <div style="margin: 0px; padding: 0px;">Hello</div>
        <input type="text" onchange="validate(this)">
        <button onclick="submitForm()">Go</button>
      </td>
    </tr>
  </table>
  <script>
    var API_KEY = "sk_live_9f2b7c41aa8e4d3f";
    function doStuff() {
      var q = "SELECT * FROM users WHERE id = " + id;
      document.getElementById("out").innerHTML = q;
      console.log("did stuff");
    }
  </script>
  <!-- TODO: fix this before launch -->
</body>
</html>
`;

const SAMPLE_CSS = `#header {
  color: red;
  font-size: 12px;
  float: left;
  z-index: 9999;
}

#nav {
  color: blue;
  float: right;
  z-index: 99999;
}

#footer {
  color: green;
  font-size: 11px;
  margin: 0px;
  padding: 0px;
}

* {
  margin: 0px;
  padding: 0px;
  box-sizing: border-box;
}

.box {
  width: 300px;
  height: 200px;
  border: 1px solid black;
  -webkit-border-radius: 4px;
  -moz-border-radius: 4px;
  -ms-border-radius: 4px;
  -o-border-radius: 4px;
  border-radius: 4px;
  color: #ff0000 !important;
  background: white !important;
}

.title {
  font-size: 18px !important;
  color: black;
  line-height: 20px;
  letter-spacing: 1px;
}

/* TODO: fix this before launch */
`;

export const SAMPLES: Record<Language | "auto", string> = {
  auto: SAMPLE_JS,
  javascript: SAMPLE_JS,
  typescript: SAMPLE_TS,
  python: SAMPLE_PYTHON,
  java: SAMPLE_JAVA,
  csharp: SAMPLE_CSHARP,
  go: SAMPLE_GO,
  rust: SAMPLE_RUST,
  php: SAMPLE_PHP,
  ruby: SAMPLE_RUBY,
  sql: SAMPLE_SQL,
  html: SAMPLE_HTML,
  css: SAMPLE_CSS,
  unknown: SAMPLE_JS,
};
