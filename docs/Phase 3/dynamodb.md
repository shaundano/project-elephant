# DynamoDB

DynamoDB is super easy to set up, it's about as easy as S3. We're going to have quite a few fields in ours.

## Creating the Table

Go over to DynamoDB and just create a table. The only thing you should know about if you're new to databases is the **Primary Key**. Primary keys are unique identifiers for a row within the database.

!!! info "Note - Primary Keys and Foreign Keys"
    If a primary key for a given row is present in another table, this is called a foreign key. This is how relational databases work; if you have a customer table and a payment method table, you would put the primary key for the payment method row in customer table, which guarantees that the payment method in the customer table will have a corresponding item in the primary key table. This is all useless here since we're only using one table, I just like to yap.

## Dynamic Schema

!!! tip "Awesome - Dynamic Columns"
    The cool thing about DynamoDB is that columns will just show up if you write to a column. Like if we send an object with "first_name and last_name", we will get those columns automatically. Pretty awesome.

We don't really need to do anything else. Before writing the actual function that writes to our database, we're going to switch gears into frontend and look at the actual data we're going to send when we schedule a meeting.

---

**Next: [Frontend →](frontend.md)**

